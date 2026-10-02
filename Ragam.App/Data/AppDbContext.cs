using Microsoft.EntityFrameworkCore;
using System.IO;

namespace Ragam.App.Data;

public class AppDbContext : DbContext
{
    public DbSet<FavoriteTrackEntity> Favorites => Set<FavoriteTrackEntity>();
    public DbSet<HistoryTrackEntity> History => Set<HistoryTrackEntity>();
    public DbSet<PlaylistEntity> Playlists => Set<PlaylistEntity>();
    public DbSet<PlaylistTrackEntity> PlaylistTracks => Set<PlaylistTrackEntity>();
    public DbSet<UserAccountEntity> Users => Set<UserAccountEntity>();

    private static readonly string DbDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "Ragam"
    );

    private static readonly string DbPath = Path.Combine(DbDirectory, "ragam_library.db");

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (!Directory.Exists(DbDirectory))
        {
            Directory.CreateDirectory(DbDirectory);
        }

        optionsBuilder.UseSqlite($"Data Source={DbPath}");
    }

    public static void InitializeDatabase()
    {
        using var context = new AppDbContext();
        context.Database.EnsureCreated();
    }
}
