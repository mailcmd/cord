defmodule CORD.MixProject do
  use Mix.Project

  def project do
    [
      app: :cord,
      version: "0.1.1",
      compilers: Mix.compilers() ++ [:post_install],
      elixir: "~> 1.18",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      aliases: aliases()
    ]
  end

  # Run "mix help compile.app" to learn about applications.
  def application do
    [
      extra_applications: [:logger, :cord],
      mod: {CORD.Application, []}
    ]
  end

  # Run "mix help deps" to learn about dependencies.
  defp deps do
    [
      {:plug_cowboy, "~> 2.0"},
      # Specific for the app below
    ]
  end

  defp aliases() do
    [
      "deps.get": ["deps.get", "update_cordjs"],
      update_cordjs: ["cmd scripts/update_cordjs.sh"]
    ]
  end
end
