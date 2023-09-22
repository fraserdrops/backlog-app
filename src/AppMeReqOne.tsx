import { useMachine } from "@xstate/react";
import { useEffect } from "react";
import "./App.css";

/* eslint-disable @typescript-eslint/no-unsafe-return */
import { assign, createMachine } from "xstate";
import { raise } from "xstate/lib/actions";

interface Ticket {
  id: string;
  title: string;
  description?: string; // This property is optional as it may not be present in all tickets, especially in the backlog list
}

interface Context {
  tickets: Ticket[];
  error: string;
  selectedTicket?: Ticket;
  selectedTicketId?: string;
}

type Events =
  | { type: "LOAD_LIST" }
  | { type: "SELECT_TICKET"; id: string }
  | { type: "RETRY_LOAD_DETAILS" }
  | { type: "RETRY_LOAD_LIST" }
  | { type: "CLOSE_DETAILS" }
  | { type: "UPDATE_TICKET" }
  | { type: "__internal__LIST_LOAD_SUCCESS" }
  | { type: "__internal__LIST_LOAD_ERROR" }
  | { type: "__internal__DETAILS_LOAD_SUCCESS" }
  | { type: "__internal__DETAILS_LOAD_ERROR" }
  | { type: "__internal__START_LOADING_DETAILS" }
  | { type: "__internal__START_LOADING_LIST" };

const backlogMachine = createMachine<Context, Events>(
  {
    id: "backlog",
    initial: "idle",
    context: {
      tickets: [],
      error: "",
      selectedTicket: undefined,
      selectedTicketId: undefined,
    },
    type: "parallel",
    states: {
      core: {
        type: "parallel",
        states: {
          loadBacklog: {
            initial: "idle",
            states: {
              idle: {
                on: {
                  LOAD_LIST: "loading",
                  __internal__START_LOADING_LIST: "loading",
                },
              },
              loading: {
                invoke: {
                  id: "loadBacklog",
                  src: "loadBacklogService",
                  onDone: {
                    target: "idle",
                    actions: [
                      assign({ tickets: (_, event) => event.data }),
                      raise("__internal__LIST_LOAD_SUCCESS"),
                    ],
                  },
                  onError: {
                    target: "idle",
                    actions: [
                      assign({ error: (_, event) => event.data }),
                      raise("__internal__LIST_LOAD_ERROR"),
                    ],
                  },
                },
              },
            },
          },
          loadDetails: {
            initial: "idle",
            states: {
              idle: {
                on: {
                  __internal__START_LOADING_DETAILS: {
                    target: "loading",
                  },
                },
              },
              loading: {
                invoke: {
                  id: "loadTicketDetail",
                  src: "loadTicketDetailService",
                  onDone: {
                    target: "idle",
                    actions: [
                      assign({
                        selectedTicket: (_, event) => event.data,
                      }),
                      raise("__internal__DETAILS_LOAD_SUCCESS"),
                    ],
                  },
                  onError: {
                    target: "idle",
                    actions: [
                      assign({ error: (_, event) => event.data }),
                      raise("__internal__DETAILS_LOAD_ERROR"),
                    ],
                  },
                },
              },
            },
          },
          updateTicketDetails: {
            initial: "idle",
            states: {
              idle: {
                on: {
                  UPDATE_TICKET: {
                    target: "updatingTicket",
                  },
                },
              },
              updatingTicket: {
                invoke: {
                  id: "updateTicket",
                  src: "updateTicketService",
                  onDone: {
                    // target: "#backlog.success",
                    actions: assign({
                      tickets: (context, event) =>
                        context.tickets.map((ticket) =>
                          ticket.id === event.data.id
                            ? { ...ticket, title: event.data.title }
                            : ticket
                        ),
                    }),
                  },
                  onError: {
                    // target: "error",
                    actions: assign({ error: (_, event) => event.data }),
                  },
                },
              },
            },
          },
        },
      },
      view: {
        type: "parallel",
        states: {
          list: {
            initial: "loading",
            on: {
              __internal__LIST_LOAD_SUCCESS: ".ready",
              __internal__LIST_LOAD_ERROR: ".error",
            },
            states: {
              loading: {
                tags: ["listLoading"],
              },
              ready: {
                tags: ["listReady"],
              },
              error: {
                tags: ["listError"],
                on: {
                  RETRY_LOAD_LIST: {
                    target: "loading",
                    actions: [raise("__internal__START_LOADING_LIST")],
                  },
                },
              },
            },
          },
          details: {
            initial: "idle",
            on: {
              __internal__DETAILS_LOAD_SUCCESS: ".ready",
              __internal__DETAILS_LOAD_ERROR: ".error",
              CLOSE_DETAILS: ".idle",
            },
            states: {
              idle: {
                tags: ["sidebarClosed"],
                on: {
                  SELECT_TICKET: {
                    target: "loading",
                    actions: [
                      assign({
                        selectedTicketId: (_, event) => event.id,
                      }),
                      raise("__internal__START_LOADING_DETAILS"),
                    ],
                  },
                },
              },
              loading: {
                tags: ["detailsLoading"],
              },
              ready: {
                tags: ["detailsReady"],
              },
              error: {
                tags: ["detailsError"],
                on: {
                  RETRY_LOAD_DETAILS: {
                    target: "loading",
                    actions: [raise("__internal__START_LOADING_DETAILS")],
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    services: {
      loadBacklogService: (context): Promise<Ticket[]> => {
        // Mock API call
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            // reject("Error");
            resolve(mockTicketList);
          }, 1000); // Simulate network delay
        });
      },
      loadTicketDetailService: (ctx, event): Promise<Ticket> => {
        // Mock API call
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            // reject("Error");
            resolve(
              ctx.selectedTicketId
                ? mockTicketDetails[ctx.selectedTicketId]
                : { id: "", title: "", description: "" }
            );
          }, 1000); // Simulate network delay
        });
      },
      updateTicketService: (ctx, event): Promise<Ticket> => {
        // Mock API call
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            reject("Error");
            resolve(
              ctx.selectedTicketId
                ? mockTicketDetails[ctx.selectedTicketId]
                : { id: "", title: "", description: "" }
            );
          }, 1000); // Simulate network delay
        });
      },
    },
  }
);

const mockTicketDetails: Record<string, Ticket> = {
  id1: { id: "id1", title: "Ticket 1", description: "Ticket 1 description..." },
  id2: { id: "id2", title: "Ticket 2", description: "Ticket 2 description..." },
  id3: { id: "id3", title: "Ticket 3", description: "Ticket 3 description..." },
};

const mockTicketList = Object.values(mockTicketDetails).map((ticket) => ({
  id: ticket.id,
  title: ticket.title,
}));

const App: React.FC = () => {
  const [current, send] = useMachine(backlogMachine);
  console.log(current, current._event);

  useEffect(() => {
    send("LOAD_LIST");
  }, [send]);

  if (current.hasTag("listLoading")) {
    return <div>Loading...</div>;
  }

  if (current.hasTag("listError")) {
    return (
      <div>
        Error loading list
        <button onClick={() => send("RETRY_LOAD_LIST")}>Retry</button>
      </div>
    );
  }
  if (current.hasTag("listReady")) {
    let sidebarState: "loading" | "viewingDetails" | "error" = "viewingDetails";
    if (current.hasTag("detailsLoading")) {
      sidebarState = "loading";
    }
    if (current.hasTag("detailsError")) {
      sidebarState = "error";
    }

    return (
      <Backlog
        tickets={current.context.tickets}
        onSelectTicket={(id: string) => send("SELECT_TICKET", { id })}
        onCloseSidebar={() => send("CLOSE_DETAILS")}
        sidebarState={sidebarState}
        sidebarOpen={!current.hasTag("sidebarClosed")}
        selectedTicket={current.context.selectedTicket}
        error={Boolean(current.context.error)}
        onRetryLoadDetails={() => send("RETRY_LOAD_DETAILS")}
      />
    );
  }

  return null;
};

export default App;

interface Ticket {
  id: string;
  title: string;
  description?: string; // This property is optional as it may not be present in all tickets, especially in the backlog list
}

interface BacklogProps {
  tickets: Ticket[];
  onSelectTicket: (id: string) => void;
  sidebarState: "loading" | "viewingDetails" | "error";
  sidebarOpen: boolean;
  selectedTicket?: Ticket;
  error?: boolean;
  onRetryLoadDetails: () => void;
  onCloseSidebar: () => void;
}

const Backlog: React.FC<BacklogProps> = ({
  tickets,
  onSelectTicket,
  onCloseSidebar,
  sidebarState,
  sidebarOpen,
  selectedTicket,
  error,
  onRetryLoadDetails,
}) => {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <h1>Backlog</h1>
      <div style={{ display: "flex" }}>
        <BacklogList tickets={tickets} onSelectTicket={onSelectTicket} />
        {sidebarOpen && (
          <>
            {sidebarState === "loading" && (
              <TicketDetailSidebar
                onCloseSidebar={onCloseSidebar}
                isLoading
                onRetryLoadDetails={onRetryLoadDetails}
              />
            )}
            {sidebarState === "viewingDetails" && (
              <TicketDetailSidebar
                onCloseSidebar={onCloseSidebar}
                ticket={selectedTicket}
                onRetryLoadDetails={onRetryLoadDetails}
              />
            )}
            {sidebarState === "error" && (
              <TicketDetailSidebar
                onCloseSidebar={onCloseSidebar}
                error={error}
                onRetryLoadDetails={onRetryLoadDetails}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
// Backlog list component
interface BacklogListProps {
  tickets: Ticket[];
  onSelectTicket: (id: string) => void;
}

const BacklogList: React.FC<BacklogListProps> = ({
  tickets,
  onSelectTicket,
}) => (
  <ul>
    {tickets.map((ticket) => (
      <li
        key={ticket.id}
        style={{ cursor: "pointer" }}
        onClick={() => onSelectTicket(ticket.id)}
      >
        {ticket.title} - {ticket.id}
      </li>
    ))}
  </ul>
);

// Ticket detail sidebar component
interface TicketDetailSidebarProps {
  ticket?: Ticket;
  isLoading?: boolean;
  error?: boolean;
  onRetryLoadDetails: () => void;
  onCloseSidebar: () => void;
}

const TicketDetailSidebar: React.FC<TicketDetailSidebarProps> = ({
  ticket,
  isLoading,
  error,
  onRetryLoadDetails,
  onCloseSidebar,
}) => {
  if (isLoading) {
    return (
      <SidebarContainer onCloseSidebar={onCloseSidebar}>
        <div>Loading ticket details...</div>{" "}
      </SidebarContainer>
    );
  }

  if (error) {
    return (
      <SidebarContainer onCloseSidebar={onCloseSidebar}>
        Error loading ticket details{" "}
        <button onClick={onRetryLoadDetails}>Retry</button>
      </SidebarContainer>
    );
  }

  if (!ticket) {
    return <div>Select a ticket to see its details</div>;
  }

  return (
    <SidebarContainer onCloseSidebar={onCloseSidebar}>
      <input value={ticket.title} />
      <p>{ticket.description}</p>
    </SidebarContainer>
  );
};

const SidebarContainer: React.FC<{
  children: React.ReactNode;
  onCloseSidebar: () => void;
}> = ({ children, onCloseSidebar }) => (
  <aside
    style={{
      position: "absolute",
      top: 0,
      right: 0,
      borderLeft: "1px solid black",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      width: 200,
      paddingTop: 40,
    }}
  >
    <div onClick={onCloseSidebar} style={{ cursor: "pointer" }}>
      Close X
    </div>
    {children}
  </aside>
);
