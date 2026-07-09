using OctoMaui.ViewModels;

namespace OctoMaui.Pages;

public partial class ChatPage : ContentPage
{
    private readonly ChatViewModel _vm;

    public ChatPage(ChatViewModel vm)
    {
        InitializeComponent();
        _vm = vm;
        BindingContext = _vm;
    }

    protected override async void OnNavigatedTo(NavigatedToEventArgs args)
    {
        base.OnNavigatedTo(args);
        // Initialize channels + websocket once the page is first shown.
        await _vm.InitializeAsync();
    }
}
