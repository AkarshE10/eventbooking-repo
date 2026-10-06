const { app, output } = require('@azure/functions');

// Define Cosmos DB Output Binding
const cosmosOutput = output.cosmosDB({
    databaseName: 'EventDB',
    containerName: 'Bookings',
    connection: 'CosmosDBConnection',
    createIfNotExists: false
});

// Define Service Bus Queue Output Binding
const serviceBusOutput = output.serviceBus({
    queueName: 'booking-queue',
    connection: 'ServiceBusConnection'
});

app.http('ProcessRegistration', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    extraOutputs: [cosmosOutput, serviceBusOutput],
    handler: async (request, context) => {
        context.log('Processing event registration request...');

        // Handle GET browser checks safely without parsing an empty JSON body
        if (request.method === 'GET') {
            return { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "ProcessRegistration API is active and ready to process registrations." }) 
            };
        }

        try {
            const body = await request.json();

            // Extract fields with fallbacks for flexible payload parsing
            const userEmail = body.userEmail || body.email;
            const eventId = body.eventId || 'EVT-101';
            const userName = body.userName || body.name || 'Guest User';
            const tickets = parseInt(body.tickets || body.ticketCount || 1, 10);

            // Validate email field presence
            if (!body || !userEmail) {
                return {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'Missing required field: Email Address' })
                };
            }

            // Create record object
            const registrationRecord = {
                id: `${eventId}-${Date.now()}`,
                eventId,
                userName,
                userEmail,
                tickets,
                registeredAt: new Date().toISOString()
            };

            // Send outputs to Cosmos DB and Service Bus
            context.extraOutputs.set(cosmosOutput, registrationRecord);
            context.extraOutputs.set(serviceBusOutput, registrationRecord);

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