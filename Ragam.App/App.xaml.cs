using System.Windows;
using Velopack;

namespace Ragam.App;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        VelopackApp.Build().Run();
        base.OnStartup(e);
    }
}
