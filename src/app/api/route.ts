export async function GET(request: Request) {
    return Response.json({
        message: "Hello from API route!"
    })
}

export async function POST(request: Request) {
    return Response.json({
        message: "POST request received!"
    })
}

export async function PUT(request: Request) {
    return Response.json({
        message: "PUT request received!"
    })
}

export async function DELETE(request: Request) {
    return Response.json({

    })
}