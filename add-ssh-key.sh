#!/bin/bash

echo "Adding SSH key to server..."
echo "You will be prompted for your password (lasolita123)"

ssh cfoeducation.it_f55qsn6wucc@94.143.138.213 'mkdir -p ~/.ssh && echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDKy3GuQ6hOgqfI03HospZkyMEoOaCKSNeL/AW37j3i0xaGyvD8CvHJWlRkj7o+/bMTk+oRRv8zio0IYQ1CGnq9c75SgxLY3+tYt+B8452GndNFG4DYiQacXx5S8SYW09hUhJkJyQY0ltwsgruYA2QxshcOQgDH1/u6JsS76/JQcOOKw2ausZDZjLoOXgaGZF8xUWY07pLQhxzmDX2UUYEDqKHF/XWt+7Th8CpKPGT48WNKWKY+ZhdBlSHtiHpDH/SvnVb9lPuvR0Dv/i4w0qULSf0VizJWdwkKXvtr6CI1ZnbHN0aZiPh9FEw6eOAC+kfvDC627Eono97PU1f5g+LhzMNtUJBJqeHV6fW6WcfBz90s6vAJ74YI2FdFuj+MRqtyS+eeh1OeQrxwFb9Xi4RwSv2G7sfY6eGVSI51F7H+wnTayhpqJQBPI6W5g5gV0XLmoxR55F9wAm1lofgRz6FxxHM/dcZrAChRs5l4diaICtBXyMQgoobPqRCVcYcgCxi+fDnIbx3E3m3QMrqsYoL89Xvzikq8Kn3sOG/6EvXGpwBLn0QPHFq6+hlQT07E7Q6eavP7dpURSJ0F3GK+6B6zBVcJMPCMRwyXEuFCJc/6vKNLSkf7Ll1IsHaRFeqfrkZDQBChU7GeL4hW1ZMhq8WiIiZja9XelO6vm1z2SHZl9w== stebbi@MacBook-Air-di-Stefano.local" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'

echo "Testing SSH connection..."
ssh -i ~/.ssh/discovery_deploy cfoeducation.it_f55qsn6wucc@94.143.138.213 "echo 'SSH key successfully added!'"