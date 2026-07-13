using System.Collections.Specialized;
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

        // Auto-scroll to the newest message whenever the collection changes.
        _vm.Messages.CollectionChanged += OnMessagesChanged;
    }

    private void OnMessagesChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (_vm.Messages.Count == 0) return;
        // Defer until the new item has been rendered.
        MainThread.BeginInvokeOnMainThread(() =>
        {
            try
            {
                // Re-check count inside the deferred lambda — a channel switch
                // or logout between the outer check and this callback can clear
                // the collection.
                if (_vm.Messages.Count == 0) return;
                var last = _vm.Messages[^1];
                MessagesList.ScrollTo(last, position: ScrollToPosition.End, animate: false);
            }
            catch
            {
                // ScrollTo can throw if the item isn't yet realized; ignore.
            }
        });
    }

    // --- drag & drop file upload ---

    private void OnDragOver(object? sender, DragEventArgs e)
    {
        _vm.IsDragOver = true;
    }

    private void OnDragLeave(object? sender, DragEventArgs e)
    {
        _vm.IsDragOver = false;
    }

    private async void OnDrop(object? sender, DropEventArgs e)
    {
        _vm.IsDragOver = false;
        if (_vm.SelectedChannel is null) return;

        try
        {
            var view = e.DataPackage.View;
            // Try text — file drops on Windows provide paths as text; on macOS
            // the text may contain file:// URIs. GetTextAsync returns null/empty
            // when text is not available, so no Contains guard is needed.
            var text = await view.GetTextAsync();
            if (!string.IsNullOrWhiteSpace(text))
            {
                var files = text.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim().TrimStart('"').TrimEnd('"'))
                    .Select(s => Uri.TryCreate(s, UriKind.Absolute, out var uri) && uri.IsFile
                        ? uri.LocalPath  // convert file:// URIs (macOS) to local paths
                        : s)
                    .Where(s => !string.IsNullOrEmpty(s) && File.Exists(s))
                    .ToList();
                if (files.Count > 0)
                    await _vm.HandleDropAsync(files);
            }
        }
        catch
        {
            // Drag-drop is best-effort; never crash on malformed payloads.
        }
    }

    protected override async void OnNavigatedTo(NavigatedToEventArgs args)
    {
        base.OnNavigatedTo(args);
        // Initialize channels + websocket once the page is first shown.
        await _vm.InitializeAsync();
    }

    protected override void OnNavigatedFrom(NavigatedFromEventArgs args)
    {
        base.OnNavigatedFrom(args);
        // Release singleton service event subscriptions held by the
        // Transient ViewModel to avoid memory leaks.
        if (BindingContext is ChatViewModel vm)
            vm.Dispose();
    }
}
