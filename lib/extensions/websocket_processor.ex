defmodule CORD.Websocket.Processor do
  use CORD.Websocket.MessageProcessor

  @sdd_config Application.compile_env(:cord, :spi_down_detector)

  @impl true
  def process_message(%{"action" => "authorize"} = msg, state) do
    msg =
      case authorize_user(msg["user"], msg["pass"]) do
        :ok ->          
          token = gen_token(msg["user"])
          store({msg["user"], :token}, token)
          store({msg["user"], :pid}, state.pid)
          msg
          |> put_in(["token"], token)
          |> put_in(["pass"], "*******")
        
        :error ->
          store({msg["user"], :token}, nil)
          put_in(msg, ["token"], nil)
      end

    reply(state, msg)
  end

  def process_message(%{"action" => "check_session"} = msg, state) do
    reply(state, check_session(msg))
  end

  def process_message(%{"action" => "subscribe"} = msg, state) do
    msg =
      with %{"session_ok" => true} <- check_session(msg),
           {_, username} <- get_token_info(msg["token"]),
           [:ok] <- ChannelsMaster.subscribe(username, String.to_atom(msg["channel"])) do
        put_in(msg, ["result_ok"], true)
      else
        %{"session_ok" => false} = msg ->
          put_in(msg, ["result_ok"], false)

        _ ->
          put_in(msg, ["result_ok"], false)
      end

    reply(state, msg)
  end

  def process_message(%{"action" => "unsubscribe"} = msg, state) do
    msg =
      with %{"session_ok" => true} <- check_session(msg),
           {_, username} <- get_token_info(msg["token"]),
           :ok <- ChannelsMaster.unsubscribe(username, String.to_atom(msg["channel"])) do
        put_in(msg, ["result_ok"], true)
      else
        %{"session_ok" => false} = msg ->
          put_in(msg, ["result_ok"], false)

        _ ->
          put_in(msg, ["result_ok"], false)
      end

    reply(state, msg)
  end

  def process_message(%{"action" => "renew_token"} = msg, state) do
    msg =
      case check_session(msg) do
        %{"session_ok" => true} ->
          %{"token" => token} = msg
          {_, username} = get_token_info(token)
          token = gen_token(username)
          store({msg["user"], :token}, token)
          put_in(msg, ["token"], token)
        
        msg ->
          msg
      end

    reply(state, msg)
  end

  def process_message(%{"action" => "get_channels"} = msg, state) do
    msg =
      with %{"session_ok" => true} <- check_session(msg),
           list <- ChannelsMaster.list_channels() do
        put_in(msg, ["channels"], list)
      else
        %{"session_ok" => false} = msg ->
          msg
      end

    reply(state, msg)
  end

  ################################################################################################
  # Fallback function
  ################################################################################################
  def process_message(msg, state) do
    Logger.log(:warning, "[CORD][Websocket][Processor] Unknwon message #{inspect msg}")
    reply(state, msg)
  end

  ################################################################################################
  ## Private Tools
  ################################################################################################
  defp store(key, value) do
    :persistent_term.put({:cord, key}, value)
  end

  defp recover(key) do
    :persistent_term.get({:cord, key}, nil)
  end

  defp check_session(msg) do
    case check_token(msg) do
      :ok ->
        msg 
        |> put_in(["session_ok"], true)

      {:renew, new_token} ->
        {_, username} = get_token_info(new_token)
        store({username, :token}, new_token)
        msg
        |> put_in(["session_ok"], true)
        |> put_in(["token"], new_token)

      :error ->
        {_, username} = get_token_info(msg["token"])
        store({username, :token}, nil)
        msg
        |> put_in(["session_ok"], false)
        |> put_in(["action"], "cord-update")
        |> Map.delete("msg_id")
        |> put_in(["token"], nil)
        |> put_in(["containers"], %{
          main: %{ token: nil, loading: false }          
        })
    end
  end

  defp check_token(msg) do
    %{"token" => token} = msg    

    with {ts, username} <- get_token_info(token),
         ts <- String.to_integer(ts),
         diff when diff > 0 <- ts - System.os_time(:second),
         ^token <- recover({username, :token}) do
      if diff < 60 do
        {:renew, gen_token(username)}
      else
        :ok
      end
    else
      _ ->
        :error
    end
  end

  defp get_token_info(nil), do: nil
  defp get_token_info(token) do
    token
    |> decrypt()
    |> String.split("-")
    |> List.to_tuple()
  end

  defp gen_token(username) do
    :second
    |> System.os_time()
    |> Kernel.+(Keyword.get(@sdd_config, :token_expire, 3_600))
    |> to_string()
    |> Kernel.<>("-#{username}")
    |> encrypt()
  end

  defp authorize_user(username, password) do
    user =
      PgSQL.Conn.get()
      |> PgSQL.query("""
        SELECT
            login
          FROM
            sys_operadores
          WHERE
            login = '#{username}' AND
            password = '#{md5(password)}'
      """)

    case length(user) do
      1 -> :ok
      _ -> :error
    end
  end

  defp decb32(n) do
    n
    |> Integer.to_string(32)
    |> String.pad_leading(2, "0")
    |> String.downcase()
  end

  defp b32dec(n) do
    String.to_integer(n, 32)
  end

  defp b32bin(n) do
    n
    |> String.codepoints()
    |> Enum.chunk_every(2)
    |> Enum.map(&Enum.join(&1,""))
    |> Enum.map(fn n -> b32dec(n) end)
  end

  defp rnd() do
    Enum.random(20..40)
  end

  defp checksum(str) do
    str
    |> :binary.bin_to_list()
    |> Enum.sum()
    |> Bitwise.band(255)
    |> decb32()
    |> String.pad_leading(2, "0")
  end

  defp encrypt(str) do
    letters = String.codepoints(str)
    ret = decb32(rnd()) <> decb32(rnd()) <> decb32(rnd())

    o =
      ret
      |> String.codepoints()
      |> Enum.chunk_every(2)
      |> Enum.map(&Enum.join(&1,""))
      |> Enum.reduce(0, fn n, acc -> acc + b32dec(n) end)
      |> div(3)

    len =
      o
      |> Kernel.-(byte_size(str))
      |> decb32()
      |> String.pad_leading(2, "0")

    j =
      letters
      |> Enum.at(0)
      |> :binary.bin_to_list()
      |> hd()
      |> Kernel.-(o)

    first =
      j
      |> decb32()
      |> String.pad_leading(2, "0")

    ret = ret <> len <> first

    ret =
      letters
      |> tl()
      |> Enum.with_index()
      |> Enum.reduce(ret, fn {l, i}, acc ->
        <<c>> = l
        acc <>
          (
          c
          |> Kernel.+(54)
          |> Kernel.+(rem(i+2, 2) == 0 && -j || j)
          |> decb32()
          |> String.pad_leading(2, "0")
          )
      end)

    ret =
      (1..div(59-byte_size(ret), 2))
      |> Enum.reduce(ret, fn _,acc ->
        n = 65..122 |> Enum.random() |> decb32() |> String.pad_leading(2, "0")
        acc <> n
      end)

    ret <> checksum(ret)
  end

  defp decrypt(nil), do: nil
  defp decrypt(str) do
    binletters = b32bin(str)
    last = List.last(binletters)
    checksum =
      str
      |> String.slice(0..57)
      |> checksum()
      |> String.to_integer(32)

    if last == checksum do
      o =
        binletters
        |> :lists.sublist(1, 3)
        |> Enum.reduce(0, fn n,acc -> acc + n end)
        |> div(3)

      binletters = :lists.sublist(binletters, 4, 60)
      len = o - Enum.at(binletters, 0)
      j = Enum.at(binletters, 1)
      ret = <<j + o>>

      2..len
      |> Enum.reduce(ret, fn i, acc ->
        acc <> <<Enum.at(binletters, i) - 54 + (rem(i,2) == 0 && j || -j)>>
      end)
      |> to_string()
    else
      nil
    end
  end

  defp md5(str) do
    str
    |> :erlang.md5()
    |> :binary.bin_to_list()
    |> Enum.map(&Integer.to_string(&1, 16))
    |> Enum.map(&String.pad_leading(&1, 2, "0"))
    |> Enum.join("")
    |> String.downcase()
  end
end
