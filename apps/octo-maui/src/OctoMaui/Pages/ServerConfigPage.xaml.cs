using OctoMaui.ViewModels;

namespace OctoMaui.Pages;

public partial class ServerConfigPage : ContentPage
{
    private readonly ServerConfigViewModel _vm;

    public ServerConfigPage(ServerConfigViewModel vm)
    {
        InitializeComponent();
        _vm = vm;
        BindingContext = _vm;
    }
}
