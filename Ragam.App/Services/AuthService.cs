using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Ragam.App.Data;

namespace Ragam.App.Services;

public record AuthStateDto(bool IsLoggedIn, string? UserName, string? UserEmail, string? AvatarUrl, string? UserId = null);

public class AuthService
{
    private static readonly string AuthFile = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "Ragam",
        "auth_session.json"
    );

    public AuthStateDto GetCurrentAuthState()
    {
        if (File.Exists(AuthFile))
        {
            try
            {
                var json = File.ReadAllText(AuthFile);
                var state = JsonSerializer.Deserialize<AuthStateDto>(json);
                if (state != null) return state;
            }
            catch { }
        }
        return new AuthStateDto(false, null, null, null);
    }

    public void SaveAuthState(AuthStateDto state)
    {
        try
        {
            var dir = Path.GetDirectoryName(AuthFile);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            File.WriteAllText(AuthFile, JsonSerializer.Serialize(state));
        }
        catch { }
    }

    public void Logout()
    {
        try
        {
            if (File.Exists(AuthFile))
            {
                File.Delete(AuthFile);
            }
        }
        catch { }
    }

    public async Task<AuthStateDto> RegisterAsync(string email, string password, string displayName, string? avatarUrl)
    {
        email = email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
        {
            throw new ArgumentException("Please enter a valid email address.");
        }
        if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
        {
            throw new ArgumentException("Password must be at least 6 characters long.");
        }

        using var db = new AppDbContext();
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (existing != null)
        {
            throw new InvalidOperationException("An account with this email already exists.");
        }

        var defaultAvatars = new[]
        {
            "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop",
            "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&h=120&fit=crop",
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop",
            "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=120&h=120&fit=crop"
        };

        var selectedAvatar = !string.IsNullOrWhiteSpace(avatarUrl)
            ? avatarUrl
            : defaultAvatars[Math.Abs(email.GetHashCode()) % defaultAvatars.Length];

        var user = new UserAccountEntity
        {
            Email = email,
            PasswordHash = HashPassword(password),
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? email.Split('@')[0] : displayName.Trim(),
            AvatarUrl = selectedAvatar
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        var state = new AuthStateDto(true, user.DisplayName, user.Email, user.AvatarUrl, user.Id);
        SaveAuthState(state);
        return state;
    }

    public async Task<AuthStateDto> LoginAsync(string email, string password)
    {
        email = email.Trim().ToLowerInvariant();
        using var db = new AppDbContext();
        var hash = HashPassword(password);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.PasswordHash == hash);

        if (user == null)
        {
            throw new InvalidOperationException("Invalid email or password.");
        }

        var state = new AuthStateDto(true, user.DisplayName, user.Email, user.AvatarUrl, user.Id);
        SaveAuthState(state);
        return state;
    }

    public AuthStateDto GuestLogin()
    {
        var state = new AuthStateDto(
            IsLoggedIn: true,
            UserName: "Guest Listener",
            UserEmail: "guest@ragam.local",
            AvatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop",
            UserId: "guest_session"
        );
        SaveAuthState(state);
        return state;
    }

    private static string HashPassword(string password)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password + "RagamSecretSalt2026"));
        return Convert.ToHexString(bytes);
    }
}
