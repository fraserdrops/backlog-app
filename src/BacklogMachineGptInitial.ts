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

type Event =
  | { type: "FETCH" }
  | { type: "SELECT_TICKET"; ticketId: string }
  | { type: "UPDATE_TITLE"; id: string; title: string }
  | { type: "CLOSE_DETAILS" }
  | { type: "RETRY_LOAD_DETAILS" }
  | { type: "RETRY_LOAD_LIST" };

export const backlogMachine = createMachine<Context, Event>(
  {
    id: "backlog",
    initial: "idle",
    context: {
      tickets: [],
      error: "",
      selectedTicket: undefined,
      selectedTicketId: undefined,
    },
    states: {
      idle: {
        on: {
          FETCH: "loading",
        },
      },
      loading: {
        invoke: {
          id: "loadBacklog",
          src: "loadBacklogService",
          onDone: {
            target: "success",
            actions: assign({ tickets: (_, event) => event.data }),
          },
          onError: {
            target: "#error",
            actions: assign({ error: (_, event) => event.data }),
          },
        },
      },
      success: {
        on: {
          SELECT_TICKET: ".ticketDetails",
          UPDATE_TITLE: ".updatingTitle",
        },
        states: {
          ticketDetails: {
            initial: "loading",
            states: {
              loading: {
                invoke: {
                  id: "loadTicketDetail",
                  src: "loadTicketDetailService",
                  onDone: {
                    target: "viewingDetails",
                    actions: assign({
                      selectedTicket: (_, event) => event.data,
                    }),
                  },
                  onError: {
                    target: "#error",
                    actions: assign({ error: (_, event) => event.data }),
                  },
                },
              },
              viewingDetails: {
                on: {
                  CLOSE_DETAILS: "#backlog.success",
                },
              },
              error: {},
            },
          },
          updatingTitle: {
            invoke: {
              id: "updateTicketTitle",
              src: "updateTicketService",
              onDone: {
                target: "#backlog.success",
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
                target: "#error",
                actions: assign({ error: (_, event) => event.data }),
              },
            },
          },
        },
      },
      error: {
        id: "error",
        on: {
          RETRY: "loading",
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
            reject("Error");
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
};

const mockTicketList = Object.values(mockTicketDetails).map((ticket) => ({
  id: ticket.id,
  title: ticket.title,
}));
