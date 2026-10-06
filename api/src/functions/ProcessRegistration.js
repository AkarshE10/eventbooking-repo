const { app } = require('@azure/functions');

app.http('ProcessRegistration', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        return { 
            status: 200, 
            body: JSON.stringify({ message: "ProcessRegistration API is working!" }) 
        };
    }
});