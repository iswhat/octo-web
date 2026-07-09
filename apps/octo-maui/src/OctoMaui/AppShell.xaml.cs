using OctoMaui.Services;

namespace OctoMaui;

public partial class AppShell : Shell
{
    private readonly IAuthService _auth;

    public AppShell(IAuthService auth)
    {
        _auth = auth;
        InitializeComponent();

        Routing.RegisterRoute("login", typeof(Pages.LoginPage));
        Routing.RegisterRoute("chat", typeof(Pages.ChatPage));

        // Route to the right page based on auth state.
        _auth.AuthStateChanged += OnAuthStateChanged;
        NavigateByAuthState();
    }

    private void OnAuthStateChanged(object? sender, EventArgs _)
        => MainThread.BeginInvokeOnMainThread(NavigateByAuthState);

    private void NavigateByAuthState()
    {
        var route = _auth.IsAuthenticated ? "chat" : "login";
        Current.GoToAsync($"//{route}");
    }
}
