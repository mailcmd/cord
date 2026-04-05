defmodule FTTH.Collector do
  alias CORD.PermanentStorage
  
  @collector_config Application.compile_env(:cord, :ftth_collector)

  @start_delay Keyword.get(@collector_config, :start_delay, 5000)
  @node_delay Keyword.get(@collector_config, :node_delay, 500)
  @node_up_thresold Keyword.get(@collector_config, :node_up_thresold, 0)
  @threads Keyword.get(@collector_config, :threads, 8)

  require Logger
  import Collector.Helpers
  alias FTTH.Storage

  def start_link() do
    pid = spawn_link(fn ->
      :timer.sleep(@start_delay)
      collector()
    end)
    {:ok, pid}
  end

  def child_spec(_) do
    %{
      id: __MODULE__,
      start: {__MODULE__, :start_link, []}
    }
  end

  def collector() do
    conn = PgSQL.Conn.get()
    nodes = PgSQL.query(conn, """
      WITH RECURSIVE tree AS (
        SELECT
            id_padre,
            id,
            -1 as id_onu
          FROM
            plg_22000_ftth_arbol
          WHERE
            id = id_padre
        UNION ALL
        SELECT
            c.id_padre,
            c.id,
            o.id_dispositivo as id_onu
          FROM
            plg_22000_ftth_arbol c
          JOIN
            tree p ON c.id_padre = p.id
          LEFT JOIN
            tec_dispositivos d ON d.id = c.id_dispositivo
          LEFT JOIN
            plg_22000_ftth_arbol o ON
                o.id_padre = c.id AND o.estado = 4 AND o.id_dispositivo is not null
          WHERE
            c.id > 1
      ) SELECT
          id_padre, id, array_agg(id_onu) ids_onus
        FROM
          tree
        WHERE
          id > 2 AND id != 64198 AND id_onu is not null
        GROUP BY
          id_padre, id
        ORDER BY
          id_padre, id
    """) 

    tree = build_tree(nodes)
    roots = tree
      |> Enum.filter(fn
        {_, %{ids_onus: _}} -> false
        _ -> true
      end)
      |> Enum.map(fn {k, _} -> k end)
      |> Enum.sort()

    Storage.set({tree, roots})

    collect_nodes()

    # next round
    :timer.sleep(@node_delay)
    collector()
  end

  # Beginnig: starts threads 
  def collect_nodes() do
    roots = :roots |> Storage.get() |> Enum.shuffle()
    t_roots = Enum.chunk_every(roots, div(length(roots), @threads))
    pid = self()
    Enum.each(1..@threads, fn i ->
      spawn_link(fn ->
        Logger.log(:notice, "[Collector]:[FTTH] Starting thread #{i}")
        collect_nodes(%{childs: :lists.nth(i, t_roots)})
        send(pid, {:collect_finished, i})
      end)
    end)
    # Wait for the N threads finishing
    await(@threads)
  end
  
  # If node has onu
  def collect_nodes(%{ids_onus: ids_onus} = node) when length(ids_onus) > 1 do
    %{childs: childs, id: id} = node
    ## check the onu FIRST
    node_data = get_node_data(id)
    cond do
      # The node is UP because ...
      node_data.lat == 0 ->
        notify(node_data, :up)
        register(node_data, :up)
        
        :timer.sleep(@node_delay)
        collect_nodes(%{childs: childs})

      # The node is UP because there is enough ONU online
      get_probes_statuses(ids_onus) > @node_up_thresold ->
        if (node_data.status == :up) do
          Logger.log(
            :warning,
            "[Collector]:[FTTH] Node #{node_data.descripcion} (id: #{id}) is UP"
          )
        end
        notify(node_data, :up)
        register(node_data, :up)
        
        :timer.sleep(@node_delay)
        collect_nodes(%{childs: childs})

      true ->
        if (node_data.status == :down) do
          Logger.log(
            :warning,
            "[Collector]:[FTTH] Node #{node_data.descripcion} (id: #{id}) is DOWN"
          )
        end
        notify(node_data, :down)
        register(node_data, :down)
        
        send_broadcast_down_childs(childs)
    end
  end

  # If node does not have onu
  def collect_nodes(%{childs: []}), do: :ok
  def collect_nodes(%{childs: childs, id: id}) do
    node_data = get_node_data(id)
    if (node_data.status == :up) do
      Logger.log(
        :warning,
        "[Collector]:[FTTH] Node #{node_data.descripcion} (id: #{id}) is UP"
      )
    end
    
    notify(node_data, :up)
    register(node_data, :up)

    # Collect childs nodes
    Enum.each(childs, fn child -> collect_nodes(get_in(Storage.get(:tree), [child])) end)
  end
  def collect_nodes(%{childs: childs}) do
    # Collect childs nodes
    Enum.each(childs, fn child -> collect_nodes(get_in(Storage.get(:tree), [child])) end)
  end

  ## Get FTTH Probe status
  defp get_probes_statuses(ids_onus, result \\ [])
  defp get_probes_statuses([], []), do: 1
  defp get_probes_statuses([], result) when length(result) == 1, do: 1
  defp get_probes_statuses([], result),
    do: (result |> Enum.filter(fn r -> r == :up end) |> length()) / length(result)
  defp get_probes_statuses([id_onu | ids_onus], result) do
    conn = PgSQL.Conn.get(:ftth)
    probe_data = PgSQL.query(conn, """
      SELECT
        estado_servicio(sp.id_locacion_cliente_pack_servicio) status,
        (SELECT valor FROM tec_dispositivos_propiedades_dispositivos
          WHERE id_dispositivo::text = dpd.valor AND id_propiedad = 3) as ip,
        (SELECT valor FROM tec_dispositivos_propiedades_dispositivos
          WHERE id_dispositivo::text = dpd.valor AND id_propiedad = 4) as comm,
        (SELECT valor FROM tec_dispositivos_propiedades_dispositivos
          WHERE id_dispositivo = #{id_onu} AND id_propiedad = 22011) as ifindex,
        case
            when sp2.valor is not null then sp2.valor
            else (
              select
                   valor
                from
                   plg_22000_ftth_configs_onu_en_olt
                where id_onu = #{id_onu} and id_propiedad = 22004
            )
        end as id_ont
      FROM
        plg_22000_ftth_arbol tree
      JOIN
        tec_dispositivos_propiedades_dispositivos dpd
            ON dpd.id_dispositivo = #{id_onu} AND dpd.id_propiedad = 22012
      JOIN
        svc_servicios_propiedades sp
            ON sp.valor = tree.id::text AND sp.id_propiedad = 22003
      LEFT JOIN
        svc_servicios_propiedades sp2
            ON sp2.id_locacion_cliente_pack_servicio = sp.id_locacion_cliente_pack_servicio AND
               sp2.id_propiedad = 22004
      WHERE
        tree.id_dispositivo = #{id_onu}
    """)

    with [%{ip: ip, comm: comm, ifindex: ifindex, id_ont: id_ont, status: 1}] <- probe_data,
        1 <- QSNMP.get(ip, comm, ".1.3.6.1.4.1.2011.6.128.1.1.2.46.1.15.#{ifindex}.#{id_ont}") do
      [:up]
    else
      # If is suspended we ignore it
      [%{status: 2}] ->
        get_probes_statuses(ids_onus, result)
      _ ->
        get_probes_statuses(ids_onus, [:down | result])
    end

  end

  def get_node_data(id, count \\ 3) do
    conn = PgSQL.Conn.get()
    info = PgSQL.query(conn, """
      SELECT
          dis.descripcion,
          tree.latitud lat,
          tree.longitud lng
        FROM
          plg_22000_ftth_arbol tree
        JOIN
          tec_dispositivos dis ON dis.id = tree.id_dispositivo
        WHERE
          tree.id = #{id}
    """)

    case {info, count} do
      {[], 0} ->
        Logger.log(:error, "[Collector]:[FTTH] WHY NODE #{id} HAS NOT DATA???")
        %{descripcion: "NODE_#{id}", lat: 0, lng: 0, status: nil}
      {[], count} ->
        :timer.sleep(@node_delay)
        get_node_data(id, count - 1)
      {[info], _} ->
        status = get_alert_status(info.descripcion)
        put_in(info, [:status], status)
    end
  end

  def get_alert_status(node_description) do
    case PermanentStorage.get({:alert, node_description}) do
      %{} -> :down
      _ -> :up
    end
  end
  ################################################################################################
  ## Tools
  ################################################################################################

  defp send_broadcast_down_childs([]), do: :ok
  defp send_broadcast_down_childs([ id | childs]) do
    Logger.log(:warning, "[Collector]:[FTTH] Node #{id} is DOWN")
    node_data = get_node_data(id)
    register(node_data, :down)
    notify(node_data, :down)
    send_broadcast_down_childs(get_in(Storage.get(:tree), [id, :childs]))
    send_broadcast_down_childs(childs)
  end

  # leaf map scheme
  # %{
  #   id: id,
  #   ids_onus: [id_onu, ... ]
  #   childs: [id, ... ]
  # }
  defp build_tree(nodes, tree \\ %{})
  defp build_tree([], tree), do: tree
  defp build_tree([ node | nodes ], tree) do
    %{id: id, id_padre: id_padre, ids_onus: ids_onus} = node
    tree =
      case tree[id_padre] do
        nil ->
          tree
            |> Map.put(id_padre, %{
              childs: [id],
              id: id_padre
            })
            |> Map.put(id, %{id: id, ids_onus: ids_onus, childs: []})

        _ ->
          tree
            |> update_in([id_padre, :childs], fn c -> c ++ [id] end)
            |> Map.put(id, %{id: id, ids_onus: ids_onus, childs: []})
      end

    build_tree(nodes, tree)
  end

  def draw_tree(), do: draw_tree(%{childs: Storage.get(:roots)}, 1)
  def draw_tree(%{childs: childs} = node, level) do
    IO.puts(
      String.duplicate(" ", max(0, level-1)*4) <>
      " |__" <>
      "#{node[:id] || 0}"
    )
    Enum.each(childs, fn child -> draw_tree(get_in(Storage.get(:tree), [child]), level + 1) end)
  end

  defp await(n) do
    receive do
      {:collect_finished, i} ->
        Logger.log(:notice, "[Collector]:[FTTH] Thread #{i} finished!")
        if n > 1, do: await(n - 1)
      msg ->
        Logger.log(:warning, "[Collector]:[FTTH] What the hell is #{inspect msg}???")
    end
  end

end
