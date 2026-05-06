defmodule CORD.DummyManager do
  use CORD.Websocket.Manager

  ################################################################################################
  # Callbacks 
  ################################################################################################
  @impl true
  def process_connection(_conn, _) do
  end

  @impl true
  def process_events(_), do: :ok

  ################################################################################################
  # Callbacks for messages
  ################################################################################################
  @impl true
  def process_message(msg, state) do
    Logger.log(:warning, "[CORD][Websocket][Processor] Unknwon message #{inspect msg}")
    reply(state, msg)
  end

end
