const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { ServiceBusClient } = require('@azure/service-bus');

app.http('ProcessRegistration', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Processing event registration request...');

        // Safe GET health check for browser testing
        if (request.method === 'GET') {
            return { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "ProcessRegistration API is active and ready." }) 
            };
        }

        try {
            const body = await request.json();

            const userEmail = body.userEmail || body.email;
            const eventId = body.eventId || 'EVT-101';
            const userName = body.userName || body.name || 'Guest User';
            const tickets = parseInt(body.tickets || body.ticketCount || 1, 10);

            if (!body || !userEmail) {
                return {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'Missing required field: Email Address' })
                };
            }

            const registrationRecord = {
                id: `${eventId}-${Date.now()}`,
                eventId,
                userName,
                userEmail,
                tickets,
                registeredAt: new Date().toISOString()
            };

            // 1. Write record to Cosmos DB
            const cosmosConn = process.env.CosmosDBConnection;
            if (cosmosConn) {
                const cosmosClient = new CosmosClient(cosmosConn);
                const container = cosmosClient.database('EventDB').container('Bookings');
                await container.items.create(registrationRecord);
            }

            // 2. Publish message to Service Bus Queue
            const sbConn = process.env.ServiceBusConnection;
            if (sbConn) {
                const sbClient = new ServiceBusClient(sbConn);
                const sender = sbClient.createSender('booking-queue');
                await sender.sendMessages({ body: registrationRecord });
                await sbClient.close();
            }

            return {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: 'Registration successful!', 
                    booking: registrationRecord 
                })
            };

        } catch (error) {
            context.error(`Error processing request: ${error.message}`);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Internal server error', error: error.message })
            };
        }
    }
});