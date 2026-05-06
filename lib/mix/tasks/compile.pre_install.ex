defmodule Mix.Tasks.Compile.PreInstall do
  use Mix.Task.Compiler

  @impl Mix.Task.Compiler
  def run(_args) do
    Mix.shell().info("Running pre-install script...")
    
    case System.cmd("sh", ["-c", "scripts/install.sh"]) do
      {_output, 0} ->
        Mix.shell().info("Pre-install completed successfully")
        {:ok, []}
      {output, _exit_code} ->
        Mix.shell().error("Pre-install script failed: #{output}")
        {:error, [%Mix.Task.Compiler.Diagnostic{
                   message: "Pre-install failed",
                   severity: :error
                 }]}
    end
  end
end
