defmodule CORD.MixProject do
  use Mix.Project

  def project do
    [
      app: :cord,
      version: "0.1.0",
      elixir: "~> 1.18",
      start_permanent: Mix.env() == :prod,
      deps: deps()
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
      # Specific
      {:pg_ex, git: "https://github.com/mailcmd/pg_ex.git" },
      {:qsnmp, git: "https://github.com/mailcmd/qsnmp.git" },      
    ]
  end
end
