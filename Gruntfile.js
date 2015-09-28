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
    
	/*
	connect: {
	    server: {
	      options: {
	        port: 9000,
	        base: 'public',
	        open: {
  				target: 'http://localhost:9000/html'
  			}
	      }
	    }
	},
	*/

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
    }
  });

  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-sass');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-requirejs');

  grunt.registerTask('default', ['requirejs', 'sass', 'copy', 'watch'/*, 'connect' */]);
	
  grunt.registerTask('deploy', ['requirejs', 'sass', 'copy']);

}