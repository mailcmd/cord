defmodule Collector.Helpers do 
  alias CORD.ChannelsMaster
  alias CORD.PermanentStorage

  def register(node, :down) do
    PermanentStorage.set({:alert, node.description}, node)
  end

  def register(node, :up) do
    PermanentStorage.remove({:alert, node.description})
  end

  def notify(_node, :up) do
    ChannelsMaster.push_event(
      :ftth,
      %{
        action: "add_alert",
        alert:
          %{
            name: "Node 28-A-1",
            lat: -38.737431287414786,
            lng: -62.23415696375327,
            rad: 580
          }
      }
    )
  end
  def notify(_node, :down) do
    ChannelsMaster.push_event(
      :ftth,
      %{
        action: "remove_alert",
        alert: %{name: "Node 28-A-1"}
      }
    )
  end

end
