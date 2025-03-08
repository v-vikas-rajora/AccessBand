document.querySelectorAll('.dropbtn').forEach(function(button) {
    button.addEventListener('click', function(event) {
        var dropdown = event.target.nextElementSibling;
        
        // Close all dropdowns first
        var allDropdowns = document.querySelectorAll('.dropdown-content');
        allDropdowns.forEach(function(d) {
            if (d !== dropdown) {
                d.style.display = 'none'; // Hide other dropdowns
            }
        });

        // Toggle the clicked dropdown
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
    });
});

// Close dropdowns if clicked outside (without closing on checkbox click)
window.onclick = function(event) {
    if (!event.target.matches('.dropbtn') && !event.target.matches('.dropdown-content') && !event.target.matches('.dropdown-content *')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        for (var i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.style.display === "block") {
                openDropdown.style.display = "none";
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', function () {
    // Fetch dropdown data from the backend API
    fetch('/reports/fetch/filterArea2')
        .then(response => response.json())
        .then(data => {
            // Initialize sets to avoid duplicates
            const schoolSet = new Set();
            const programSet = new Map(); // Programs for each school
            const semesterSet = new Map(); // Semesters for each program
            const sectionSet = new Map(); // Sections for each semester

            // Loop through data and add values to the sets
            data.forEach(item => {
                schoolSet.add(item.school);       // Store school names

                // Add programs for each school
                if (!programSet.has(item.school)) {
                    programSet.set(item.school, []);
                }
                programSet.get(item.school).push(item.program);

                // Add semesters for each program
                if (!semesterSet.has(item.program)) {
                    semesterSet.set(item.program, []);
                }
                semesterSet.get(item.program).push(item.sem);

                // Add sections for each semester
                if (!sectionSet.has(item.sem)) {
                    sectionSet.set(item.sem, []);
                }
                sectionSet.get(item.sem).push(item.section);
            });

            // Function to populate dropdown and update button text based on selections
            function populateDropdown(dropdown, set, button) {
                set.forEach(item => {
                    const option = document.createElement('label');
                    option.innerHTML = `<input type="checkbox"> ${item}`;
                    dropdown.appendChild(option);
                });

                // Add event listener to checkboxes
                dropdown.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                    checkbox.addEventListener('change', function() {
                        const selectedItems = [];
                        // Get selected items
                        dropdown.querySelectorAll('input[type="checkbox"]:checked').forEach(checkedBox => {
                            selectedItems.push(checkedBox.parentElement.innerText.trim());
                        });

                        // Update button text with the selected items
                        if (selectedItems.length > 0) {
                            button.innerHTML = selectedItems.join(', ');
                        } else {
                            button.innerHTML = `Choose ${button.innerText.split(' ')[1]}`;  // Reset to default text
                        }
                    });
                });
            }

            // Populate the school dropdown
            const schoolDropdown = document.querySelector('.dropdown-content.first');
            const schoolButton = document.querySelector('.dropdown .dropbtn.first');
            populateDropdown(schoolDropdown, schoolSet, schoolButton);

            // Populate the program dropdown (Initially empty)
            const programDropdown = document.querySelectorAll('.dropdown-content')[1];
            const programButton = document.querySelectorAll('.dropdown .dropbtn')[1];
            populateDropdown(programDropdown, [], programButton); // Initially empty

            // Populate the semester dropdown (Initially empty)
            const semesterDropdown = document.querySelectorAll('.dropdown-content')[2];
            const semesterButton = document.querySelectorAll('.dropdown .dropbtn')[2];
            populateDropdown(semesterDropdown, [], semesterButton); // Initially empty

            // Populate the section dropdown (Initially empty)
            const sectionDropdown = document.querySelectorAll('.dropdown-content')[3];
            const sectionButton = document.querySelectorAll('.dropdown .dropbtn')[3];
            populateDropdown(sectionDropdown, [], sectionButton); // Initially empty

            // Function to update program dropdown based on selected schools
            function updateProgramDropdown(schools) {
                // Clear the existing program options
                programDropdown.innerHTML = '';

                // Collect programs for selected schools
                let programsToShow = [];
                schools.forEach(school => {
                    const programs = programSet.get(school) || [];
                    programsToShow = [...new Set([...programsToShow, ...programs])]; // Combine programs of all selected schools
                });

                // Populate the program dropdown with programs of the selected schools
                programsToShow.forEach(program => {
                    const programOption = document.createElement('label');
                    programOption.innerHTML = `<input type="checkbox"> ${program}`;
                    programDropdown.appendChild(programOption);
                });

                // Reinitialize event listeners for the new checkboxes in program dropdown
                programDropdown.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                    checkbox.addEventListener('change', function() {
                        const selectedPrograms = [];
                        programDropdown.querySelectorAll('input[type="checkbox"]:checked').forEach(checkedBox => {
                            selectedPrograms.push(checkedBox.parentElement.innerText.trim());
                        });

                        // Update program button text
                        if (selectedPrograms.length > 0) {
                            programButton.innerHTML = selectedPrograms.join(', ');
                        } else {
                            programButton.innerHTML = 'Choose Program';  // Reset if no program selected
                        }

                        // Update semester and section dropdowns when program is selected/unselected
                        if (selectedPrograms.length > 0) {
                            updateSemesterDropdown(selectedPrograms);
                        } else {
                            // Reset semester and section dropdowns if no program is selected
                            updateSemesterDropdown([]);
                            updateSectionDropdown([]);
                        }
                    });
                });
            }

            // Function to update semester dropdown based on selected programs
            function updateSemesterDropdown(programs) {
                // Clear the existing semester options
                semesterDropdown.innerHTML = '';

                // Collect semesters for selected programs
                let semestersToShow = [];
                programs.forEach(program => {
                    const semesters = semesterSet.get(program) || [];
                    semestersToShow = [...new Set([...semestersToShow, ...semesters])]; // Combine semesters of all selected programs
                });

                // Populate the semester dropdown with semesters of the selected programs
                semestersToShow.forEach(semester => {
                    const semesterOption = document.createElement('label');
                    semesterOption.innerHTML = `<input type="checkbox"> ${semester}`;
                    semesterDropdown.appendChild(semesterOption);
                });

                // Reinitialize event listeners for the new checkboxes in semester dropdown
                semesterDropdown.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                    checkbox.addEventListener('change', function() {
                        const selectedSemesters = [];
                        semesterDropdown.querySelectorAll('input[type="checkbox"]:checked').forEach(checkedBox => {
                            selectedSemesters.push(checkedBox.parentElement.innerText.trim());
                        });

                        // Update semester button text
                        if (selectedSemesters.length > 0) {
                            semesterButton.innerHTML = selectedSemesters.join(', ');
                        } else {
                            semesterButton.innerHTML = 'Choose Semester';  // Reset if no semester selected
                        }

                        // Update section dropdown based on selected semester
                        if (selectedSemesters.length > 0) {
                            updateSectionDropdown(selectedSemesters);
                        } else {
                            // Reset section dropdown if no semester is selected
                            updateSectionDropdown([]);
                        }
                    });
                });
            }

            // Function to update section dropdown based on selected semesters
            function updateSectionDropdown(semesters) {
                // Clear the existing section options
                sectionDropdown.innerHTML = '';

                // Collect sections for selected semesters
                let sectionsToShow = [];
                semesters.forEach(semester => {
                    const sections = sectionSet.get(semester) || [];
                    sectionsToShow = [...new Set([...sectionsToShow, ...sections])]; // Combine sections of all selected semesters
                });

                // Populate the section dropdown with sections of the selected semesters
                sectionsToShow.forEach(section => {
                    const sectionOption = document.createElement('label');
                    sectionOption.innerHTML = `<input type="checkbox"> ${section}`;
                    sectionDropdown.appendChild(sectionOption);
                });

                // Reinitialize event listeners for the new checkboxes in section dropdown
                sectionDropdown.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                    checkbox.addEventListener('change', function() {
                        const selectedSections = [];
                        sectionDropdown.querySelectorAll('input[type="checkbox"]:checked').forEach(checkedBox => {
                            selectedSections.push(checkedBox.parentElement.innerText.trim());
                        });

                        // Update section button text
                        if (selectedSections.length > 0) {
                            sectionButton.innerHTML = selectedSections.join(', ');
                        } else {
                            sectionButton.innerHTML = 'Choose Section';  // Reset if no section selected
                        }
                    });
                });
            }

            // Add event listener for school selection
            schoolDropdown.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    const selectedSchools = [];
                    schoolDropdown.querySelectorAll('input[type="checkbox"]:checked').forEach(checkedBox => {
                        selectedSchools.push(checkedBox.parentElement.innerText.trim());
                    });

                    // Update the program dropdown based on selected schools
                    if (selectedSchools.length > 0) {
                        updateProgramDropdown(selectedSchools);
                    } else {
                        // Reset program, semester, and section dropdowns if no school is selected
                        updateProgramDropdown([]);
                        updateSemesterDropdown([]);
                        updateSectionDropdown([]);
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
});


document.getElementById('modifySearchBtn').addEventListener('click', function() {
    // Expand the search area by removing the 'collapsed' class
    document.getElementById('searchArea').classList.remove('collapsed');
    
    document.getElementById('searchInnerArea').style.display = 'block';
    // Hide the 'Modify Search' button after it is clicked
    document.getElementById('modifySearchBtn').style.display = 'none';

    document.getElementById('fetchtableArea').classList.add('min');
    document.getElementById('fetchtableArea').classList.remove('max');

});