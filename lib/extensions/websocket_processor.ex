defmodule CORD.Websocket.Processor do
  use CORD.Websocket.MessageProcessor

  @config Application.compile_env(:cord, :local_config)

  @impl true
  def process_message(%{"msg_id" => msg_id, "action" => "authorize"} = msg, state) do
    # IO.inspect msg
    token = 
      case authorize_user(msg["user"], msg["pass"]) do
        :ok -> gen_token(msg["user"])
        _ -> nil        
      end

    store({msg["user"], :token}, token)
    msg = %{msg_id: msg_id, token: token}
    
    state
    |> assign(:token, token)
    |> reply(msg)
  end

  def process_message(%{"msg_id" => _msg_id, "action" => "----"} = msg, _state) do
    case check_token(msg) do
      :ok ->
        :ok
      
      :error ->
        :error
    end
  end
  
  
  ################################################################################################
  # Fallback function
  ################################################################################################
  def process_message(msg, state) do
    Logger.log(:warning, "[CORD][Websocket][Processor] Unknwon message #{inspect msg}")
    encrypt(state) |> decrypt()
    state
    |> reply(msg)
  end

  ################################################################################################
  ## Private Tools
  ################################################################################################
  defp store(key, value) do
    :persistent_term.put({:cord, key}, value)
  end
  
  defp recover(key) do
    :persistent_term.get({:cord, key})
  end

  defp check_token(msg) do
    %{token: token} = msg
    [ts, username] = 
      token
      |> decrypt()
      |> String.split("-")

    with ts <- String.to_integer(ts),
         true <- ts > System.os_time(:second),
         ^token <- recover({username, :token}) do
      :ok
    else
      _ ->
        :error
    end
  end

  defp gen_token(username) do
    :second
    |> System.os_time()
    |> Kernel.+(Keyword.get(@config, :token_expire, 3_600))
    |> to_string()
    |> Kernel.<>("-#{username}")
    |> encrypt()
  end

  defp authorize_user(_username, _password) do
    :ok
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
end
