namespace OctoMaui;

public partial class App : Application
{
    public App()
    {
        InitializeComponent();
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        // Shell routes between Login and Chat based on auth state.
        return new Window(new AppShell());
    }
}
