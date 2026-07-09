using System.Windows.Input;
using OctoMaui.Services;

namespace OctoMaui.ViewModels;

public sealed class LoginViewModel : ViewModelBase
{
    private readonly IAuthService _auth;

    public LoginViewModel(IAuthService auth) => _auth = auth;

    public string Username { get => Get<string>(); set => Set(value); }
    public string Password { get => Get<string>(); set => Set(value); }
    public string ErrorMessage { get => Get<string>(); set => Set(value); }
    public bool IsBusy { get => Get<bool>(); set => Set(value); }

    public ICommand LoginCommand => CreateCommand(async () => await LoginAsync(), () => !IsBusy);

    private async Task LoginAsync()
    {
        if (string.IsNullOrWhiteSpace(Username) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "请输入用户名和密码";
            return;
        }

        IsBusy = true;
        ErrorMessage = string.Empty;
        try
        {
            var ok = await _auth.LoginAsync(Username, Password);
            if (!ok)
                ErrorMessage = "登录失败，请检查用户名和密码";
        }
        catch (Exception ex)
        {
            ErrorMessage = $"登录异常: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }
}
