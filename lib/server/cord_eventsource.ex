defmodule CORD.EventSource do
  import Plug.Conn
  
	def loop(conn) do
    message = JSON.decode!("""
    {
      "action": "cord-update-object",
      "containers": {
        "counter": {
          "value": {
            "action": "mul",
            "datas": 2
          }
        }
      }
    }
    """)
    # IO.inspect message
    send_message(conn, message)
    :timer.sleep(5000)
    loop(conn)
	end

  defp send_message(conn, message) when is_binary(message) do
    message = String.replace(message, ~r/\n/, " ")
    chunk(conn, "event: \"message\"\n\ndata: \"#{message}\"\n\n")
  end
  
  defp send_message(conn, message) when is_map(message) do
    message = JSON.encode!(message)
    chunk(conn, "event: \"message\"\n\ndata: #{message}\n\n")
  end
end
