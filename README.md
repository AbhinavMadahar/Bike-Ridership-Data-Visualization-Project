# Citibike Visualisation

**Fatima Al-Sadeeh, Abhinav Madahar <abhinav.madahar@rutgers.edu>, Samuel Sohn.**
**CS 539 Spring 2020.**
**Prof. Abello.**

This project visualises Citibike NYC data.
The data itself can be found [on the official website](https://www.citibikenyc.com/system-data).
For convenience, here are some useful endpoints:

- GET https://gbfs.citibikenyc.com/gbfs/en/station\_information.json
- GET https://gbfs.citibikenyc.com/gbfs/en/station\_status.json

To use the repository, please run `make` first to install required packages, download the dataset, load the database, etc.
Then, run `. env/bin/activate; python src/server.py` to start the server on port 5000.
It will give you a URL from which you can access the program.

## Client Code

I wrote the client code as simply as I could.
It does not use any frameworks like Angular or libraries like React or jQuery.
Instead, it uses built-in tools and libraries.

State is tracked using both the DOM entities like `input` entities and global variables like `from` and `hour`.
The entry-point for the client code is the `main` function.
