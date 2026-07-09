# OCTO Maui — PC Client (.NET MAUI)

> Cross-platform PC client for the OCTO messaging platform, built with .NET MAUI.
> Targets Windows, macOS (Mac Catalyst), Android, and iOS from a single codebase.

This is the C# / .NET MAUI companion to the existing Electron PC client in
[`apps/web/src-election`](../../web/src-election). Both talk to
[`octo-server`](https://github.com/Mininglamp-OSS/octo-server) over REST +
WebSocket; this project offers a native .NET desktop experience while Electron
remains the web-stack option.

## Why a second PC client?

| | Electron (`apps/web`) | .NET MAUI (`apps/octo-maui`) |
|---|---|---|
| Stack | TypeScript / React | C# / .NET 8 |
| Runtime | Chromium + Node | Native .NET |
| Best for | Web devs, shared UI with browser | Native Windows integration, .NET ecosystem |
| Bundle | Larger (~150 MB) | Smaller (~30 MB) |

Both are first-class; pick the one that fits your team.

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) (LTS)
- MAUI workload: `dotnet workload install maui`
- Windows: Visual Studio 2022 17.8+ with "MAUI" workload, or `dotnet` CLI
- macOS: `dotnet workload install maui` + Xcode for iOS/MacCatalyst builds

## Build & Run

```bash
cd apps/octo-maui

# Restore + run on Windows
dotnet restore
dotnet build -t:Run -f net8.0-windows10.0.19041.0

# Or run on Mac Catalyst
dotnet build -t:Run -f net8.0-maccatalyst
```

By default the client expects an `octo-server` instance at
`http://localhost:8080`. Override it in `appsettings.json` or via the
`OCTO_API_BASE` environment variable.

## Project structure

```
apps/octo-maui/
├── OctoMaui.sln
└── src/OctoMaui/
    ├── OctoMaui.csproj          # MAUI project (multi-target)
    ├── MauiProgram.cs           # DI container + startup
    ├── App.xaml(.cs)            # Application root
    ├── AppShell.xaml(.cs)       # Shell routing (login → chat)
    ├── Pages/                   # XAML views (Login, Chat, Main)
    ├── ViewModels/              # MVVM (ViewModelBase, LoginVM, ChatVM)
    ├── Models/                  # Data models (User, Message, Channel)
    ├── Services/                # API + WebSocket clients to octo-server
    ├── Resources/               # Styles, colors, fonts, images
    └── Platforms/               # Per-platform specifics (Windows/Android/iOS/Mac)
```

## Architecture

MVVM with `CommunityToolkit.Mvvm`-style structure (hand-rolled for zero hidden
magic):

- **Pages** are pure XAML + code-behind, bound to ViewModels.
- **ViewModels** expose `INotifyPropertyChanged` via `ViewModelBase`.
- **Services** (`ApiService`, `WebSocketService`, `AuthService`) are injected
  through `MauiProgram` DI and talk to `octo-server`.
- **Models** mirror the `octo-server` REST schema.

## Status

This is the initial scaffold. Login + chat shell compile and run against a
local `octo-server`; streaming replies, file uploads, and tray integration are
tracked separately.

## License

Apache 2.0 — same as the parent `octo-web` repository.
