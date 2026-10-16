using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(o => o.ServiceName = "RCC PatchGuard Agent");
builder.Services.AddHttpClient("api", client => client.Timeout = TimeSpan.FromSeconds(45));
builder.Services.AddHostedService<AgentWorker>();
await builder.Build().RunAsync();

public sealed class AgentWorker(IHttpClientFactory clients, ILogger<AgentWorker> log) : BackgroundService
{
    private readonly string api = Environment.GetEnvironmentVariable("RCC_API_URL")?.TrimEnd('/') ?? "";
    private readonly string token = Environment.GetEnvironmentVariable("RCC_AGENT_TOKEN") ?? "";
    private readonly string deviceId = Environment.MachineName;
    private DateTimeOffset nextScan = DateTimeOffset.MinValue;
    private readonly HashSet<string> processed = new();
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        if (!Uri.TryCreate(api, UriKind.Absolute, out var uri) || uri.Scheme != "https" || string.IsNullOrWhiteSpace(token))
        { log.LogError("Set RCC_API_URL (HTTPS) and RCC_AGENT_TOKEN system environment variables."); return; }
        while (!stop.IsCancellationRequested)
        {
            try
            {
                await Send("/api/agent/heartbeat", new { deviceId, hostname = Environment.MachineName, os = Environment.OSVersion.VersionString, version = "1.0.0", timestamp = DateTimeOffset.UtcNow }, stop);
                if (DateTimeOffset.UtcNow >= nextScan) { await Scan(stop); nextScan = DateTimeOffset.UtcNow.AddHours(12); }
                await Poll(stop);
            }
            catch (OperationCanceledException) when (stop.IsCancellationRequested) { break; }
            catch (Exception ex) { log.LogError(ex, "Agent cycle failed"); }
            await Task.Delay(TimeSpan.FromMinutes(2), stop);
        }
    }
    private HttpClient Client()
    {
        var c = clients.CreateClient("api");
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return c;
    }
    private async Task Send(string path, object payload, CancellationToken ct)
    {
        using var c = Client(); using var r = await c.PostAsJsonAsync(api + path, payload, ct); r.EnsureSuccessStatusCode();
    }
    private async Task Scan(CancellationToken ct)
    {
        var updates = await Task.Run(() => WindowsUpdates.Scan(), ct);
        await Send("/api/agent/scan-results", new { deviceId, updates, scannedAt = DateTimeOffset.UtcNow }, ct);
        log.LogInformation("Scan reported {Count} updates", updates.Count);
    }
    private async Task Poll(CancellationToken ct)
    {
        using var c = Client();
        using var r = await c.GetAsync(api + "/api/agent/commands?deviceId=" + Uri.EscapeDataString(deviceId), ct);
        r.EnsureSuccessStatusCode();
        var commands = await r.Content.ReadFromJsonAsync<List<AgentCommand>>(cancellationToken: ct) ?? [];
        foreach (var command in commands)
        {
            if (string.IsNullOrWhiteSpace(command.Id) || !processed.Add(command.Id)) continue;
            string status = "success", message = "Completed";
            try
            {
                switch (command.Type)
                {
                    case "scan": await Scan(ct); break;
                    case "install":
                        if (command.Approved != true || command.KbIds is not { Count: > 0 }) throw new InvalidOperationException("Explicit approval and KB selection required");
                        message = await Task.Run(() => WindowsUpdates.Install(command.KbIds), ct);
                        break;
                    default: throw new InvalidOperationException("Unsupported command");
                }
            }
            catch (Exception ex) { status = "failed"; message = ex.Message; log.LogError(ex, "Command {Id} failed", command.Id); }
            try { await Send("/api/agent/command-results", new { deviceId, commandId = command.Id, status, message, completedAt = DateTimeOffset.UtcNow }, ct); }
            catch { processed.Remove(command.Id); throw; }
        }
    }
}
public sealed record AgentCommand(string Id, string Type, bool? Approved, List<string>? KbIds);
public sealed record PatchInfo(string Title, List<string> KbIds, string UpdateId, bool RequiresReboot);
public static class WindowsUpdates
{
    // Windows Update Agent COM is Windows-only. Run the service with appropriate privileges.
    public static List<PatchInfo> Scan()
    {
        dynamic session = Activator.CreateInstance(Type.GetTypeFromProgID("Microsoft.Update.Session")!)!;
        dynamic searcher = session.CreateUpdateSearcher();
        dynamic result = searcher.Search("IsInstalled=0 and Type='Software' and IsHidden=0");
        var patches = new List<PatchInfo>();
        for (int i = 0; i < result.Updates.Count; i++)
        {
            dynamic u = result.Updates.Item(i); var kbs = new List<string>();
            for (int j = 0; j < u.KBArticleIDs.Count; j++) kbs.Add((string)u.KBArticleIDs.Item(j));
            patches.Add(new PatchInfo((string)u.Title, kbs, (string)u.Identity.UpdateID, (bool)u.RebootRequired));
        }
        return patches;
    }
    public static string Install(List<string> requestedKbs)
    {
        var allowed = requestedKbs.Select(k => k.Replace("KB", "", StringComparison.OrdinalIgnoreCase)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        dynamic session = Activator.CreateInstance(Type.GetTypeFromProgID("Microsoft.Update.Session")!)!;
        dynamic searcher = session.CreateUpdateSearcher();
        dynamic result = searcher.Search("IsInstalled=0 and Type='Software' and IsHidden=0");
        dynamic selected = Activator.CreateInstance(Type.GetTypeFromProgID("Microsoft.Update.UpdateColl")!)!;
        for (int i = 0; i < result.Updates.Count; i++)
        {
            dynamic u = result.Updates.Item(i);
            bool match = false;
            for (int j = 0; j < u.KBArticleIDs.Count; j++) if (allowed.Contains((string)u.KBArticleIDs.Item(j))) match = true;
            if (!match) continue;
            if (!(bool)u.EulaAccepted) u.AcceptEula();
            selected.Add(u);
        }
        if (selected.Count == 0) return "No matching applicable updates";
        dynamic downloader = session.CreateUpdateDownloader(); downloader.Updates = selected;
        dynamic download = downloader.Download();
        if ((int)download.ResultCode != 2) throw new InvalidOperationException("Download failed, result code: " + download.ResultCode);
        dynamic installer = session.CreateUpdateInstaller(); installer.Updates = selected;
        dynamic installed = installer.Install();
        return $"Installation result={installed.ResultCode}; rebootRequired={installed.RebootRequired}; count={selected.Count}";
    }
}
