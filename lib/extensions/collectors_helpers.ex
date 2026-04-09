defmodule Collector.Helpers do 
  alias CORD.ChannelsMaster
  alias CORD.PermanentStorage

  def register(node, :up, _channel) do
    PermanentStorage.remove({:alert, node.id})
  end

  def register(node, :down, channel) do
    node =
      node
      |> put_in([:ts], System.os_time(:second))
      |> put_in([:channel], channel)
      |> Map.delete(:status)
    PermanentStorage.set({:alert, node.id}, node)
  end

  def notify(node, :up, channel) do
    ChannelsMaster.push_event(
      channel,
      %{
        action: "remove_alert",
        alert: %{id: node.id}
      }
    )
  end
  
  def notify(node, :down, channel) do
    ChannelsMaster.push_event(
      channel,
      %{
        action: "add_alert",
        alert: node
      }
    )
  end

end
