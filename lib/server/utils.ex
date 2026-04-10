defmodule CORD.Utils do
	def string_keys_to_atom(map) do
    map |> Enum.map(fn
      {k,v} when is_binary(k) -> {String.to_atom(k), v}
      {k,v} -> {k,v}
    end) |> Enum.into(%{})
  end  
end
