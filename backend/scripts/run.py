from backend.app import create_app  # Updated import path

app = create_app()

if __name__ == '__main__':
    app.run(debug=True)