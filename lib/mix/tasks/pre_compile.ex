defmodule Mix.Tasks.Compile.PreInstall do
  use Mix.Task.Compiler

  @impl Mix.Task.Compiler
  def run(_args) do
    # Run your custom command here
    case System.cmd("sh", ["-c", "scripts/install.sh"]) do
      {_output, 0} ->
        {:ok, []}
      {output, _exit_code} ->
        Mix.shell().error("Pre-install script failed: #{output}")
        {:error, [%Mix.Task.Compiler.Diagnostic{
                   file: "scripts/pre_install.sh",
                   position: 0,
                   compiler_name: :pre_install,
                   message: "Pre-install failed",
                   severity: :error
                 }]}
    end
  end
end
