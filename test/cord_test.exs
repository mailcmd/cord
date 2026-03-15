defmodule CORDTest do
  use ExUnit.Case
  doctest CORD

  test "greets the world" do
    assert CORD.hello() == :world
  end
end
