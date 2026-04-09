defmodule DOCSIS.Supervisor do
	use Supervisor

  def start_link(_) do
    Supervisor.start_link(__MODULE__, [], name: __MODULE__)
  end

  @impl true
  def init(_) do
    children = [
      # FTTH.Storage,
      # DOCSIS.Collector
    ]

    Supervisor.init(children, strategy: :one_for_all)
  end
  
end
