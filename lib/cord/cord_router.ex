defmodule CORD.Router do
  use Plug.Router

  @config Application.compile_env!(:cord, :http)
  @root_dir Keyword.fetch!(@config, :root_dir)

  plug :match
  plug :dispatch

  get "/" do
    index_file = File.read!("#{@root_dir}/index.html")
    send_resp(conn, 200, index_file)
  end

  match _ do
    send_resp(conn, 404, "Oops!")
  end
end
