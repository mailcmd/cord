defmodule CORD.Websocket.Processor do
  require Logger
  
  def process_message(%{"msg_id" => msg_id, "action" => "authorize"} = msg, _state) do
    IO.inspect msg
    Process.sleep(4000)
    msg = %{msg_id: msg_id, authorize: true}
    JSON.encode!(msg)
  end

  # Fallback function
  def process_message(msg, _state) do
    Logger.log(:warning, "[CORD][Websocket] Unknwon message #{inspect msg}")
    JSON.encode!(msg)
  end
end
