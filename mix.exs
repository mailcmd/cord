defmodule CORD.MixProject do
  use Mix.Project

  def project do
    [
      app: :cord,
      version: "0.1.0",
      elixir: "~> 1.18",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      aliases: aliases()
    ]
  end

  # Run "mix help compile.app" to learn about applications.
  def application do
    [
      extra_applications: [:logger],
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
      "deps.get": ["deps.get", "update"],
      update: ["cmd scripts/update_cordjs.sh"]
    ]
  end
end
