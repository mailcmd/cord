defmodule CORD.Websocket do
  @behaviour :cowboy_websocket

  require Logger
  
  def init(conn, opts) do
    Logger.log(:info, "[CORD][Websocket] Connection open")
    {
      :cowboy_websocket,
      conn,
      %{
        pid: conn.pid,
        message_processor: Keyword.get(opts, :message_processor),
        conn: conn
      },
      %{
        # 1 min w/o a ping from the client and the connection is closed
        idle_timeout: 3_600_000,
        # Max incoming frame size of 1 MB
        max_frame_size: 1_000_000,
      }
    }
  end

  def websocket_init(state \\ %{}) do
    {:ok, state}
  end

  def terminate(_reason, _conn, _state) do
    Logger.log(:info, "[CORD][Websocket] Connection closed")
    :ok
  end

  ################################################################################################
  ## Main receiver
  ################################################################################################
  def websocket_handle({:text, msg}, state) do
    # IO.inspect state
    # IO.inspect msg, label: "RECEIVED"
    msg = 
      case JSON.decode(msg) do
        {:ok, json} -> json
        _ -> msg
      end
    {state, response} = process_message(msg, state)
    # IO.inspect response, label: "RESPONSE"
    {:reply, {:text, response}, state}
  end

  ################################################################################################
  ## Unknown messages
  ################################################################################################
  def websocket_info(msg, state) do
    # IO.inspect msg, label: "INFO"
    {:reply, {:text, msg}, state}
  end

  defp process_message(msg, %{message_processor: nil}) do
    JSON.encode!(msg)
  end
  defp process_message(msg, %{message_processor: processor} = state) do
    processor.process_message(msg, state)
  end
  
end
