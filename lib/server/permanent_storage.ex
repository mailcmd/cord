defmodule CORD.PermanentStorage do
  use Agent
  require Logger

  def start_link(_) do
    case :dets.open_file(:permanent_storage,
                         [type: :set, file: ~c"priv/permanent_storage.dets"]) do
      {:error, reason} ->
        Logger.log(:error,
                   "[PermanentStorage] Problems with storage DB (#{inspect reason})")
        {:stop, reason}
      
      {:ok, table} ->
        Agent.start_link(fn -> table end, name: __MODULE__)
    end
  end

  def get(key) do
    Agent.get(__MODULE__, fn table ->
      case :dets.lookup(table, key) do
        [{_, config}] -> config
        _ -> :error
      end
    end)
  end

  def set(key, value) do
    Agent.get(__MODULE__, fn table ->
      :dets.insert(table, {key, value})
      :dets.sync(table)
    end)
  end

  def remove(key) do
    Agent.get(__MODULE__, fn table ->
      :dets.delete(table, key)
    end)
  end

  def get_matchs(pattern) do
    Agent.get(__MODULE__, fn table ->
      table
      |> :dets.match(pattern)
      |> List.flatten()
    end)
  end
end
