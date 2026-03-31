defmodule FTTH.Storage do
  use Agent

  def start_link(_) do
    Agent.start_link(fn -> {nil, nil} end, name: __MODULE__)
  end
  def get() do
    Agent.get(__MODULE__, fn status -> status end)
  end
  def get(:tree) do
    {tree, _} = Agent.get(__MODULE__, fn status -> status end)
    tree
  end
  def get(:roots) do
    {_, roots} = Agent.get(__MODULE__, fn status -> status end)
    roots
  end
  def set({tree, roots}) do
    Agent.update(__MODULE__, fn _ -> {tree, roots} end)
  end
  def set(:tree, tree) do
    Agent.update(__MODULE__, fn {_, roots} -> {tree, roots} end)
  end
  def set(:roots, roots) do
    Agent.update(__MODULE__, fn {tree, _} -> {tree, roots} end)
  end
end
