import { useMachine } from "@xstate/react";
import { useEffect, useState } from "react";
import "../App.css";

/* eslint-disable @typescript-eslint/no-unsafe-return */
import { assign, createMachine } from "xstate";

interface Ticket {
  id: string;
  title: string;
  description?: string; // This property is optional as it may not be present in all tickets, especially in the backlog list
}

interface Context {
  tickets: Ticket[];
  selectedTicket?: Ticket;
  selectedTicketId?: string;
}

type Event =
  | { type: "LOAD_LIST" }
  | { type: "SELECT_TICKET"; id: string }
  | { type: "UPDATE_TITLE"; id: string; title: string }
  | { type: "CLOSE_DETAILS" }
  | { type: "RETRY_LOAD_DETAILS" }
  | { type: "RETRY_LOAD_LIST" };

const backlogMachine = createMachine<Context, Event>(
  {
    id: "backlog",
    initial: "idle",
    context: {
      tickets: [],
      selectedTicket: undefined,
      selectedTicketId: undefined,
    },
    states: {
      idle: {
        on: {
          LOAD_LIST: "loading",
        },
      },
      loading: {
        tags: ["listLoading"],
        invoke: {
          id: "loadBacklog",
          src: "loadBacklogService",
          onDone: {
            target: "listReady",
            actions: ["setLoadedTickets"],
          },
          onError: {
            target: "#error",
          },
        },
      },
      listReady: {
        tags: ["listReady"],
        initial: "idle",
        on: {
          SELECT_TICKET: {
            target: ".ticketDetails",
            actions: ["setSelectedTicketId"],
          },
          CLOSE_DETAILS: {
            target: "#backlog.listReady",
            internal: false,
          },
        },
        states: {
          idle: {},
          ticketDetails: {
            initial: "loading",
            states: {
              loading: {
                tags: ["detailsLoading"],
                invoke: {
                  id: "loadTicketDetail",
                  src: "loadTicketDetailService",
                  onDone: {
                    target: "viewingDetails",
                    actions: ["setSelectedTicket"],
                  },
                  onError: {
                    target: "error",
                  },
                },
              },
              viewingDetails: {
                initial: "idle",
                tags: ["detailsReady"],
                states: {
                  idle: {
                    on: {
                      UPDATE_TITLE: "updatingTitle",
                    },
                  },
                  updatingTitle: {
                    invoke: {
                      id: "updateTicketTitle",
                      src: "updateTicketService",
                      onDone: {
                        target: "idle",
                        actions: "updateTicketDetails",
                      },
                      onError: {
                        target: "#error",
                      },
                    },
                  },
                },
              },
              error: {
                tags: ["detailsError"],
                on: {
                  RETRY_LOAD_DETAILS: "loading",
                },
              },
            },
          },
        },
      },
      error: {
        id: "error",
        tags: ["listError"],
        on: {
          RETRY_LOAD_LIST: "loading",
        },
      },
    },
  },
  {
    actions: {
      setSelectedTicket: assign({
        selectedTicket: (_, event) => event.data,
      }),
      updateTicketDetails: assign({
        tickets: (context, event) =>
          context.tickets.map((ticket) =>
            ticket.id === event.data.id
              ? { ...ticket, title: event.data.title }
              : ticket
          ),
        selectedTicket: (ctx, event) => event.data,
      }),
      setLoadedTickets: assign({ tickets: (_, event) => event.data }),
      setSelectedTicketId: assign({
        selectedTicketId: (_, event) => event.id,
      }),
    },
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
        return new Promise((resolve) => {
          setTimeout(() => {
            // reject("Error");
            if (event.id && mockTicketDetails[event.id]) {
              mockTicketDetails[event.id] = {
                ...mockTicketDetails[event.id],
                title: event.title,
              };
            }
            resolve(
              event.id
                ? {
                    ...mockTicketDetails[event.id],
                    title: event.title,
                  }
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

  let listState: UIState = "loading";
  if (current.hasTag("listError")) {
    listState = "error";
  }
  if (current.hasTag("listReady")) {
    listState = "ready";
  }

  let sidebarState: UIState = "inactive";
  if (current.hasTag("detailsLoading")) {
    sidebarState = "loading";
  }
  if (current.hasTag("detailsError")) {
    sidebarState = "error";
  }
  if (current.hasTag("detailsReady")) {
    sidebarState = "ready";
  }

  if (current.hasTag("detailsErrorRetrying")) {
    sidebarState = "errorRetrying";
  }

  console.log("sidebarstate", sidebarState, current.tags);

  return (
    <Backlog
      tickets={current.context.tickets}
      onSelectTicket={(id: string) => send({ type: "SELECT_TICKET", id })}
      onCloseSidebar={() => send("CLOSE_DETAILS")}
      listState={listState}
      sidebarState={sidebarState}
      selectedTicket={current.context.selectedTicket}
      onRetryLoadDetails={() => send("RETRY_LOAD_DETAILS")}
      onUpdateTitle={(title, id) =>
        send({
          type: "UPDATE_TITLE",
          id,
          title,
        })
      }
      onRetryLoadList={() => send("RETRY_LOAD_LIST")}
    />
  );
};

export default App;

interface Ticket {
  id: string;
  title: string;
  description?: string; // This property is optional as it may not be present in all tickets, especially in the backlog list
}
type UIState = "inactive" | "loading" | "ready" | "error" | "errorRetrying";
interface BacklogProps {
  tickets: Ticket[];
  onSelectTicket: (id: string) => void;
  sidebarState: UIState;
  listState: UIState;
  selectedTicket?: Ticket;
  onRetryLoadDetails: () => void;
  onCloseSidebar: () => void;
  onUpdateTitle: (title: string, id: string) => void;
  onRetryLoadList: () => void;
}

const Backlog: React.FC<BacklogProps> = ({
  tickets,
  onSelectTicket,
  onCloseSidebar,
  sidebarState,
  selectedTicket,
  onRetryLoadDetails,
  onRetryLoadList,
  onUpdateTitle,
  listState,
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
        <BacklogList
          listState={listState}
          tickets={tickets}
          onSelectTicket={onSelectTicket}
          onRetryLoadList={onRetryLoadList}
        />
        <TicketDetailSidebar
          sidebarState={sidebarState}
          onCloseSidebar={onCloseSidebar}
          onRetryLoadDetails={onRetryLoadDetails}
          onUpdateTitle={onUpdateTitle}
          ticket={selectedTicket}
        />
      </div>
    </div>
  );
};
// Backlog list component
interface BacklogListProps {
  listState: UIState;
  tickets: Ticket[];
  onSelectTicket: (id: string) => void;
  onRetryLoadList: () => void;
}

const BacklogList: React.FC<BacklogListProps> = ({
  listState,
  tickets,
  onSelectTicket,
  onRetryLoadList,
}) => {
  if (listState === "loading") {
    return <div>Loading...</div>;
  }

  if (listState === "error") {
    return (
      <div>
        Error loading list
        <button onClick={onRetryLoadList}>Retry</button>
      </div>
    );
  }
  return (
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
};
// Ticket detail sidebar component
interface TicketDetailSidebarProps {
  ticket?: Ticket;
  sidebarState: UIState;
  onRetryLoadDetails: () => void;
  onCloseSidebar: () => void;
  onUpdateTitle: (title: string, id: string) => void;
}

const TicketDetailSidebar: React.FC<TicketDetailSidebarProps> = ({
  ticket,
  sidebarState,
  onRetryLoadDetails,
  onCloseSidebar,
  onUpdateTitle,
}) => {
  const [tempValue, setTempValue] = useState(ticket?.title || "");
  useEffect(() => {
    setTempValue(ticket?.title || "");
  }, [ticket?.title]);

  if (sidebarState === "inactive") {
    return null;
  }

  if (sidebarState === "loading") {
    return (
      <SidebarContainer onCloseSidebar={onCloseSidebar}>
        <div>Loading ticket details...</div>{" "}
      </SidebarContainer>
    );
  }

  if (sidebarState === "error") {
    return (
      <SidebarContainer onCloseSidebar={onCloseSidebar}>
        Error loading ticket details{" "}
        <button onClick={onRetryLoadDetails}>Retry</button>
      </SidebarContainer>
    );
  }

  if (sidebarState === "errorRetrying") {
    return (
      <SidebarContainer onCloseSidebar={onCloseSidebar}>
        Error loading ticket details...retrying
      </SidebarContainer>
    );
  }

  if (!ticket) {
    return <div>Select a ticket to see its details</div>;
  }

  return (
    <SidebarContainer onCloseSidebar={onCloseSidebar}>
      <input value={tempValue} onChange={(e) => setTempValue(e.target.value)} />
      <button onClick={() => onUpdateTitle(tempValue, ticket.id)}>Save</button>
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
