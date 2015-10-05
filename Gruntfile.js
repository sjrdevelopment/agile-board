module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        
        copy: {
            html: {
                files: [
                    {
                        flatten: true,
                        expand: true,
                        src: ['src/html/index.html'],
                        dest: 'api/public/'
                    }
                ]
            }
        },
        

        connect: {
            server: {
              options: {
                port: 9000,
                base: 'api/public',
                open: {
                    target: 'http://localhost:9000'
                }
              }
            },
            jasmine: {
              options: {
                port: 8000,
                open: {
                    target: 'http://localhost:8000/_SpecRunner.html'
                }
              }
            }
        },


        sass: {
            options: {
                outputStyle: 'compact',
                includePaths: ['src/scss']
            },
            dist: {
                files: {
                    'api/public/assets/css/main.css' : 'src/scss/main.scss'
                }
            }
        },
        
        requirejs: {
            compile: {
                options: {
                    baseUrl: "src",
                    mainConfigFile: "src/js/config.js",
                    name: "../bower_components/almond/almond", // assumes a production build using almond
                    out: "api/public/assets/js/compiled.js",
                    findNestedDependencies: true,
                    include: 'js/main.js',
                    optimize: 'none',
                    preserveLicenseComments: false,
                    wrap: true
                }
            }
        },

        watch: {
            css: {
                files: 'src/scss/*.scss',
                tasks: ['sass']
            },

            js: {
                files: ['src/js/*.js', 'src/js/collections/*.js', 'src/js/models/*.js', 'src/js/views/*.js'],
                tasks: ['requirejs']
            },

            hbs: {
                files: 'src/hbs/*.hbs',
                tasks: ['requirejs']
            },

            options: {
                livereload: true
            }
        },

        jshint: {
            files: ['src/js/*.js', 'src/js/collections/*.js', 'src/js/models/*.js', 'src/js/views/*.js'],
            options: {
                curly: true,
                eqeqeq: true,
                eqnull: true,
                browser: true,
                globals: {
                    jQuery: true
                },
            }
        },

        jasmine: {
            yourTask: {
                options: {
                    src: 'src/js/**/*.js',
                    specs: 'src/js/**/tests/*spec.js',
                    host: 'http://localhost:8000/',
                    template: require('grunt-template-jasmine-requirejs'),
                    keepRunner: true,
                    templateOptions: {
                        requireConfig: {
                            baseUrl: '.',
                            paths: {
                                // libs
                                "jquery": "bower_components/jquery/dist/jquery.min",
                                "underscore": "bower_components/underscore/underscore-min",
                                "backbone": "bower_components/backbone/backbone-min",
                                "handlebars": "bower_components/handlebars/handlebars.min",
                                "requirejs": "bower_components/requirejs/require",
                                "text": "bower_components/requirejs-text/text",

                                // constants
                                "constants": "src/js/constants/modelViewConstants",

                                // components
                                "storiesCollection": "src/js/collections/stories",
                                "storyModel": "src/js/models/story",
                                "storyView": "src/js/views/story",
                                "tasksCollection": "src/js/collections/tasks",
                                "taskModel": "src/js/models/task",
                                "taskView": "src/js/views/task",
                                "editStoryModel": "src/js/models/edit-story",
                                "editStoryView": "src/js/views/edit-story",
                                "editTaskModel": "src/js/models/edit-task",
                                "editTaskView": "src/js/views/edit-task"
                             },

                            deps: [
                                'jquery'
                            ],

                            shim: {
                                backbone: {
                                    deps: ['underscore', 'jquery'],
                                    'exports': 'backbone'
                                }
                            },

                            hbars: {
                                extension: '.hbs'
                            }
                        }
                    }
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-sass');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-requirejs');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-jasmine');

    grunt.registerTask('default', ['jshint', 'jasmine', 'requirejs', 'sass', 'copy', 'connect', 'watch' ]); // comment out connect
    grunt.registerTask('test', ['connect:jasmine', 'jasmine']);
    grunt.registerTask('deploy', ['jshint', 'jasmine', 'requirejs', 'sass', 'copy']);
}