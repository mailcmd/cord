defmodule CORD.EventsMaster do
	use GenServer

  require Logger
  alias CORD.ChannelsMaster

  ################################################################################################
  ## Public API
  ################################################################################################ 
  def start_link({run_interval, event_processor}) do
    GenServer.start_link(__MODULE__, {run_interval, event_processor}, name: __MODULE__)
  end

  ################################################################################################
  ## Callbacks
  ################################################################################################
  @impl true
  def init(state) do
    Logger.log(:info, "[EventsMaster] Initializing events manager...")
    {:ok, state, {:continue, :schedule_next_run}}
  end

  @impl true
  def handle_continue(:schedule_next_run, {run_interval, _} = state) do
	  Process.send_after(self(), :pop_events, run_interval)
    {:noreply, state}
  end

  @impl true
  def handle_info(:pop_events, {_, event_processor} = state) do
	  events = ChannelsMaster.pop_all_events()
    event_processor.process_events(events)
    {:noreply, state, {:continue, :schedule_next_run}}
  end
end
