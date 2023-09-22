/* eslint-disable @typescript-eslint/no-unsafe-return */
import { assign, createMachine } from "xstate";

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
  | { type: "SELECT"; id: string }
  | { type: "RETRY_LOAD_DETAILS" }
  | { type: "RETRY_LOAD_LIST" }
  | { type: "CLOSE_DETAILS" }
  | { type: "UPDATE_TICKET" }
  | { type: "__internal__LIST_LOAD_SUCCESS" }
  | { type: "__internal__LIST_LOAD_ERROR" }
  | { type: "__internal__DETAILS_LOAD_SUCCESS" }
  | { type: "__internal__DETAILS_LOAD_ERROR" };

export const backlogMachine = createMachine<Context, Events>(
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
                },
              },
              loading: {
                invoke: {
                  id: "loadBacklog",
                  src: "loadBacklogService",
                  onDone: {
                    actions: assign({ tickets: (_, event) => event.data }),
                  },
                  onError: {
                    actions: assign({ error: (_, event) => event.data }),
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
                  SELECT: {
                    target: "loading",
                    actions: assign({
                      selectedTicketId: (_, event) => event.id,
                    }),
                  },
                },
              },
              loading: {
                invoke: {
                  id: "loadTicketDetail",
                  src: "loadTicketDetailService",
                  onDone: {
                    actions: assign({
                      selectedTicket: (_, event) => event.data,
                    }),
                  },
                  onError: {
                    actions: assign({ error: (_, event) => event.data }),
                  },
                },
              },
            },
          },
          updateTicketDetails: {
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
              loading: {},
              ready: {},
              error: {},
            },
          },
          details: {
            initial: "loading",
            on: {
              __internal__DETAILS_LOAD_SUCCESS: ".ready",
              __internal__DETAILS_LOAD_ERROR: ".error",
            },
            states: {
              loading: {},
              ready: {},
              error: {},
            },
            // on: {
            //   SELECT: {
            //     target: "loading",
            //     actions: assign({ selectedTicketId: (_, event) => event.id }),
            //   },
            //   CLOSE_DETAILS: "#backlog.success",
            //   UPDATE_TICKET: {
            //     target: "updatingTicket",
            //   },
            // },
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
            // reject("Error");
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
