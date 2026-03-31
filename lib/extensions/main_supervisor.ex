defmodule SPIDownDetector do
  @moduledoc """
                        MAIN_SUP
                 __________|_______ 
        ________/     |            \_____
       /              |                  \
     PGSQL        FTTH_SUP           DOCSIS_SUP
                    |
                ___/ \__
               /        \
          STORAGE    COLLECTOR       
  
  """
	use Supervisor

  @config Application.compile_env(:cord, :spi_down_detector)
  
  def start_link(_) do
    Supervisor.start_link(__MODULE__, [], name: __MODULE__)
  end

  @impl true
  def init(_) do
    pg_conn_data = @config[:db]
    children = [
      {PgSQL, [struct(PgSQL.Conn, pg_conn_data)]},
      FTTH.Supervisor
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
  
end
