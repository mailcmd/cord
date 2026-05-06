defmodule Mix.Tasks.PreInstall do
  use Mix.Task

  def run(_args) do
    Mix.shell().info("Running pre-install script...")
    
    case System.cmd("sh", ["-c", "scripts/install.sh"]) do
      {_output, 0} ->
        Mix.shell().info("Pre-install completed successfully")
      {output, _exit_code} ->
        Mix.shell().error("Pre-install script failed: #{output}")
    end
  end
end
