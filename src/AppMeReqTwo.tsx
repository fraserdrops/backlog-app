import { useMachine } from "@xstate/react";
import { useEffect, useState } from "react";
import "./App.css";

/* eslint-disable @typescript-eslint/no-unsafe-return */
import { useSearchParams } from "react-router-dom";
import { assign, createMachine } from "xstate";
import { raise } from "xstate/lib/actions";

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

type Events =
  | { type: "LOAD_LIST" }
  | { type: "SELECT_TICKET"; id: string }
  | { type: "RETRY_LOAD_DETAILS" }
  | { type: "RETRY_LOAD_LIST" }
  | { type: "CLOSE_DETAILS" }
  | { type: "UPDATE_TITLE"; id: string; title: string }
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
                      "setLoadedTickets",
                      raise("__internal__LIST_LOAD_SUCCESS"),
                    ],
                  },
                  onError: {
                    target: "idle",
                    actions: [raise("__internal__LIST_LOAD_ERROR")],
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
                      "setSelectedTicket",
                      raise("__internal__DETAILS_LOAD_SUCCESS"),
                    ],
                  },
                  onError: {
                    target: "idle",
                    actions: [raise("__internal__DETAILS_LOAD_ERROR")],
                  },
                },
              },
            },
          },
          updateDetails: {
            initial: "idle",
            states: {
              idle: {
                on: {
                  UPDATE_TITLE: "updatingDetails",
                },
              },
              updatingDetails: {
                invoke: {
                  id: "updateTicketTitle",
                  src: "updateTicketService",
                  onDone: {
                    target: "idle",
                    actions: "updateTicketDetails",
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
            initial: "idle",
            on: {
              __internal__LIST_LOAD_SUCCESS: ".ready",
              __internal__LIST_LOAD_ERROR: ".error",
            },
            states: {
              idle: {
                on: {
                  LOAD_LIST: {
                    target: "loading",
                    actions: [raise("__internal__START_LOADING_LIST")],
                  },
                },
              },
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
              SELECT_TICKET: {
                target: ".loading",
                actions: [
                  "setSelectedTicketId",
                  raise("__internal__START_LOADING_DETAILS"),
                ],
              },
            },
            states: {
              idle: {},
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
  const [searchParams] = useSearchParams();
  const [current, send] = useMachine(backlogMachine);
  useEffect(() => {
    const selectedId = searchParams.get("selectedId");
    if (selectedId !== null) {
      send({ type: "SELECT_TICKET", id: selectedId });
    }
  }, [searchParams, send]);
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
  if (current.hasTag("listErrorRetrying")) {
    listState = "errorRetrying";
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
  onRetryLoadDetails,
  onRetryLoadList,
  onUpdateTitle,
  listState,
  selectedTicket,
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
          onUpdateTitle={onUpdateTitle}
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
  onUpdateTitle: (title: string, id: string) => void;
}

const BacklogList: React.FC<BacklogListProps> = ({
  listState,
  tickets,
  onSelectTicket,
  onRetryLoadList,
  onUpdateTitle,
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

  if (listState === "errorRetrying") {
    return <div>Error loading list...retrying</div>;
  }
  return (
    <ul>
      {tickets.map((ticket) => (
        <BacklogListItem
          key={ticket.id}
          ticket={ticket}
          onSelectTicket={onSelectTicket}
          onUpdateTitle={onUpdateTitle}
        />
      ))}
    </ul>
  );
};

const BacklogListItem: React.FC<{
  ticket: Ticket;
  onSelectTicket: (id: string) => void;
  onUpdateTitle: (title: string, id: string) => void;
}> = ({ ticket, onSelectTicket, onUpdateTitle }) => {
  const [draftTitle, setDraftTitle] = useState(ticket?.title || "");
  useEffect(() => {
    setDraftTitle(ticket?.title || "");
  }, [ticket?.title]);
  return (
    <li>
      <input
        value={draftTitle}
        onChange={(e) => setDraftTitle(e.target.value)}
      />{" "}
      -{" "}
      <div
        style={{ cursor: "pointer" }}
        onClick={() => onSelectTicket(ticket.id)}
      >
        {ticket.id}{" "}
      </div>
      <button onClick={() => onUpdateTitle(draftTitle, ticket.id)}>Save</button>
    </li>
  );
};
// Ticket detail sidebar component
interface TicketDetailSidebarProps {
  ticket?: Ticket;
  onRetryLoadDetails: () => void;
  onCloseSidebar: () => void;
  onUpdateTitle: (title: string, id: string) => void;
  sidebarState: UIState;
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
