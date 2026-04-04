defmodule Collector.Helpers do
 
  def register(_node, :down) do
  end
  def register(_node, :up) do    
  end

  def notify(_node, :up) do
    CORD.ChannelsMaster.push_event(
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
    CORD.ChannelsMaster.push_event(
      :ftth,
      %{
        action: "remove_alert",
        alert: %{name: "Node 28-A-1"}
      }
    )
  end

end
