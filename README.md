## Agile board

### Project setup

The project contains `api` and `src` directories.
`src` is the self-contained web front-end and Backbone.js app.
`api` is the server running the REST api.
 
 -  Before running the steps below, setup the API dependencies by running `npm install` in the `api` directory.

##### Steps

1. In the solution's root directory run `npm install` followed by `bower install`
2. Once all npm and bower components are installed, you can run `grunt test` which will run the Jasmine tests in the terminal window, and also open the Spec Runner in the web browser port 8000.
3. Next run `grunt deploy`, which will build and copy the solution's assets over to `api/public` (the web server's root directory)
3. cd into `api`
4. run `npm start` to run the server as per the coding challenge instructions.  This will start the api and the web server
5. Go to `http://localhost:3000` in your browser and begin adding, editing and deleting stories and tasks
6. You can also run the Jasmine tests in the solution's root directory by running `grunt test`.  This will run the tests in the terminal window but also open the Jasmine Spec Runner in `http://localhost:8000` for a more user friendly report

### Assumptions
1. The app will be run on Mac OSX and Google Chrome only
2. Node and npm are setup and installed already

### Further improvements
 - Further Jasmine test coverage
 - Adding Marionette for use alongside Backbone for features such as the view UI hash, view regions, and composite views (for displaying collection and sub models together)
 - Refactoring views and models to be more DRY - tasks and stories essentially do the same thing just with different API endpoints - their views and models could be merged or extend from same base model/view.
 - Mapping tasks to stories in data, e.g: providing an interface to tasks from the story with methods such as storyModel.getTasks() and storyModel.getTasksByStatus(), as API doesn’t provide a way of querying a stories’ associated tasks.
 - Further develop responsive mobile-first design (I used some sass medium-up and large-up mixins to set up a basic responsive layout but it needs refining)
 - Story/task filtering, order by priority, colour-coding by priority

