defmodule CORD.ChannelsMaster do
  @moduledoc """
  table records:
    - {:available_channels, MapSet()}                            # uniq
    - {{:subscription, channel, client_id}}                        # multiple
      ...
    - {{:event_queue, timestamp}, {channel, event_description}}    # multiple
      ...
  
  """
  use GenServer

  require Logger
  
  ################################################################################################
  ## Public API
  ################################################################################################ 
  def start_link(channels \\ []) do
    GenServer.start_link(__MODULE__, channels, name: __MODULE__)
  end

  def subscribe(client_id, channel) when not is_list(channel),
      do: subscribe(client_id, [channel])
  def subscribe(client_id, channels) do
    GenServer.call(__MODULE__, {:subscribe, client_id, channels})
  end

  def unsubscribe(client_id, channel) when not is_list(channel),
      do: unsubscribe(client_id, [channel])
  def unsubscribe(client_id, channels) do
    GenServer.call(__MODULE__, {:unsubscribe, client_id, channels})
  end

  def add_channel(channel) do
    GenServer.call(__MODULE__, {:add_channel, channel})
  end

  def remove_channel(channel) do
    GenServer.call(__MODULE__, {:remove_channel, channel})
  end

  def list_channels() do
    GenServer.call(__MODULE__, :list_channels)
  end

  def get_channel_clients(channel) do
    GenServer.call(__MODULE__, {:channel_clients, channel})
  end

  def get_client_channels(client_id) do
    GenServer.call(__MODULE__, {:client_channels, client_id})
  end
  
  def push_event(channel, event) do
    GenServer.call(__MODULE__, {:push_event, channel, event})
  end

  def pop_events(channel) do
    GenServer.call(__MODULE__, {:pop_events, channel})
  end
  
  def pop_all_events() do
    GenServer.call(__MODULE__, :pop_all_events)
  end

  ################################################################################################
  ## Callbacks
  ################################################################################################
  @impl true
  def init(channel) when not is_list(channel), do: init([channel])
  def init(channels) do
    Logger.log(:notice, "[ChannelsMaster] Initializing channels DB...")
    case :dets.open_file(:channels_master, [type: :set, file: ~c"priv/channels.dets"]) do
      {:error, reason} ->
        Logger.log(:error, "[ChannelsMaster] Problems with channels DB (#{inspect reason})")
        {:stop, reason}
      
      {:ok, table} ->
        current_channels = get_available_channels(table)
        new_channels_list = current_channels ++ channels
        :dets.insert(table, {:available_channels, MapSet.new(new_channels_list)})
        {:ok, table}
    end
  end

  @impl true
  def terminate(_, table) do
	  :dets.close(table)
  end

  @impl true
  def handle_call({:add_channel, channel}, _from, table) do
    current_channels = get_available_channels(table)
    new_channels_list = [channel | current_channels]
    :dets.insert(table, {:available_channels, MapSet.new(new_channels_list)})
	  :dets.sync(table)

    Logger.log(:notice, "[ChannelsMaster] Channel '#{channel}' added!")
    push_broadcast_event(%{action: :add_channel, target: channel}, table)

    {:reply, Enum.uniq(new_channels_list), table}
  end

  def handle_call({:remove_channel, channel}, _from, table) do
    current_channels = get_available_channels(table)
    new_channels_list =
      current_channels
      |> Enum.filter(&(&1 != channel))

    :dets.match_delete(table, {{:subscription, channel, :"$1"}})
    :dets.insert(table, {:available_channels, MapSet.new(new_channels_list)})
	  :dets.sync(table)
    
    push_broadcast_event(%{action: :remove_channel, target: channel}, table)
    Logger.log(:notice, "[ChannelsMaster] Channel '#{channel}' removed!")

    {:reply, new_channels_list, table}
  end

  def handle_call(:list_channels, _from, table) do
    current_channels =
      table
      |> get_available_channels()
      |> Enum.filter(&(&1 != :broadcast))
    {:reply, current_channels, table}
  end

  def handle_call({:subscribe, client_id, channels}, _from, table) do
    current_channels = get_available_channels(table)
    result = 
      Enum.map(channels, fn ch ->
        with {1, true} <- {1, Enum.member?(current_channels, ch)},
             {2, :ok} <- {2, :dets.insert(table, {{:subscription, ch, client_id}})} do
          Logger.log(:notice, "[ChannelsMaster] Client '#{client_id}' subscribed to '#{ch}'")
          :ok
        else
          {1, _} -> 
            Logger.log(:warning, "[ChannelsMaster] Channel #{ch} not available!")
            :error
          {2, _} ->
            Logger.log(:warning, "[ChannelsMaster] Problems subscribing #{client_id} to #{ch}")
            :error
        end
      end)
	  :dets.sync(table)
    {:reply, result, table}
  end

  def handle_call({:unsubscribe, client_id, channels}, _from, table) do
    Enum.each(channels, fn ch ->     
      :dets.delete_object(table, {{:subscription, ch, client_id}})
      Logger.log(:notice, "[ChannelsMaster] Client '#{client_id}' unsubscribed of '#{ch}'")
    end)
	  :dets.sync(table)
    {:reply, :ok, table}
  end

  def handle_call({:channel_clients, channel}, _from, table) do
    clients = :dets.match(table, {{:subscription, channel, :"$1"}})
    {:reply, List.flatten(clients), table}
  end

  def handle_call({:client_channels, client_id}, _from, table) do
    channels = :dets.match(table, {{:subscription, :"$1", client_id}})
    {:reply, List.flatten(channels), table}
  end

  def handle_call({:push_event, channel, event}, _from, table) do
    new_event = {{:event_queue, System.os_time()}, channel, event}
    :dets.insert(table, new_event)
	  :dets.sync(table)
    Logger.log(:notice, "[ChannelsMaster] pushed event '#{inspect event}' to channel '#{channel}'")
    {:reply, new_event, table}
  end
  
  def handle_call({:pop_events, channel}, _from, table) do
    events = :dets.match(table, {{:event_queue, :"$1"}, channel, :"$2"})
    :dets.match_delete(table, {{:event_queue, :"$1"}, channel, :"$2"})
	  :dets.sync(table)
    Logger.log(:notice, "[ChannelsMaster] poped events from channel '#{channel}'")
    {:reply, events, table}
  end
  
  def handle_call(:pop_all_events, _from, table) do
    events = :dets.match(table, {{:event_queue, :"$1"}, :"$2", :"$3"})
    :dets.match_delete(table, {{:event_queue, :"$1"}, :"$2", :"$3"})
	  :dets.sync(table)
    Logger.log(:debug, "[ChannelsMaster] poped all events")
    {:reply, events, table}
  end
  
  ################################################################################################
  ## Private
  ################################################################################################
  defp get_available_channels(table) do
    case :dets.lookup(table, :available_channels) do
      [{_, mapset}] -> MapSet.to_list(mapset)
      _ -> []
    end
  end

  defp push_broadcast_event(event, table) do
    handle_call({:push_event, :broadcast, event}, nil, table)
  end

end
